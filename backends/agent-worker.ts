// backends/agent-worker.ts — Worker entry point.
// Spawned by tauri-plugin-js inside the Tauri app. Detects first run
// (FR-SETUP-01), creates a real Pi SDK session in the configured AB directory
// (excludeTools: ["bash"]) and exposes WorkerAPI to the frontend over kkrpc
// stdio transport. Includes permission layer, system prompt assembly,
// auto-commit lifecycle, and forked reflect on shutdown.

import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { RPCChannel } from "kkrpc";
import { nodeStdioTransport } from "kkrpc/stdio";

import type {
  FrontendAPI,
  PromptOptions,
  SetupConfig,
  WorkerAPI,
} from "../shared/api";
import { adoptAbInstance, createAbInstance } from "./create-ab";
import { defaultAbLocation, validateLocation } from "./location";
import { listModelsForProvider } from "./model-listing";
import { OAuthService } from "./oauth-service";
import { alignHttpDispatcherWithPi } from "./pi-http-dispatcher";
import { checkPrerequisites } from "./prereqs";
import { assembleSystemPrompt } from "./prompt";
import { configureProviderKey, defaultAuthPath } from "./provider-auth";
import {
  fromPiProviderId,
  toPiProviderId,
  WIZARD_PI_PROVIDERS,
} from "./provider-mapping";
import { toIsoDay } from "./deferred";
import { SessionLifecycle } from "./session-lifecycle";
import { augmentPromptWithAttachments, bootSession } from "./session-boot";
import { defaultConfigPath, detectFirstRun } from "./setup";
import { createWorkerCore } from "./worker-core";

async function main(): Promise<void> {
  await alignHttpDispatcherWithPi();

  const authPath = defaultAuthPath();
  const modelRuntime = await ModelRuntime.create({ authPath });

  // FR-SETUP-01: on first run there is no AB directory to open a session in.
  // The channel is created either way (the wizard talks to the worker later);
  // the Pi session only exists when an AB is configured, rooted at its dir.
  let setupState = detectFirstRun(defaultConfigPath());

  let core: ReturnType<typeof createWorkerCore> | undefined;
  let lifecycle: SessionLifecycle | undefined;
  // Definite assignment: set right after the channel is created below, and
  // bootSession only runs after that.
  let frontend!: FrontendAPI;

  // Pending permission questions: id → resolver (FR-PERM-07). The tool call
  // awaits inside the beforeToolCall hook until the user answers in the chat.
  const pendingPermissions = new Map<number, (allow: boolean) => void>();
  let nextPermissionId = 1;
  const sessionAllowedPaths = new Set<string>();

  let oauthService: OAuthService | undefined;

  function ensureOAuthService(): OAuthService {
    if (!oauthService) {
      oauthService = new OAuthService(modelRuntime, {
        onEvent: (event) => frontend.onOAuthEvent(event),
      });
    }
    return oauthService;
  }

  async function startSession(
    abDirectory: string,
    options?: { firstSession?: boolean; name?: string; about?: string },
  ): Promise<void> {
    if (core) return;

    const booted = await bootSession(
      abDirectory,
      {
        frontend,
        modelRuntime,
        sessionAllowedPaths,
        requestPermission: (request) => {
          const id = nextPermissionId++;
          return new Promise<boolean>((resolveAnswer) => {
            pendingPermissions.set(id, resolveAnswer);
            frontend.onPermissionRequest({ ...request, id });
          });
        },
      },
      options,
    );
    if (!booted) return;
    core = booted.core;
    lifecycle = booted.lifecycle;
  }

  const transport = nodeStdioTransport();
  const channel = new RPCChannel<WorkerAPI, FrontendAPI>(transport, {
    expose: {
      async prompt(text: string, options?: PromptOptions) {
        const augmented = await augmentPromptWithAttachments(text, sessionAllowedPaths, options);
        await core?.api.prompt(augmented.text, augmented.images ? { images: augmented.images } : undefined);
      },
      async abort() {
        await core?.api.abort();
      },
      async getState() {
        if (!core) throw new Error("worker not ready");
        return core.api.getState();
      },
      async getDeferredItems() {
        if (setupState.firstRun) return [];
        const today = toIsoDay(new Date());
        const { dueItems } = assembleSystemPrompt(setupState.config.abDirectory);
        return dueItems.map((item) => ({
          type: item.type,
          dueDate: item.dueDate,
          source: item.source,
          text: item.text,
          overdue: item.dueDate < today,
        }));
      },
      async getSetupState() {
        return setupState;
      },
      async checkPrerequisites() {
        return checkPrerequisites();
      },
      async getDefaultLocation() {
        return defaultAbLocation();
      },
      async validateLocation(path: string) {
        return validateLocation(path);
      },
      async configureProviderKey(provider, apiKey, baseUrl) {
        return configureProviderKey(provider, apiKey, { baseUrl });
      },
      async loginOAuth(provider) {
        return ensureOAuthService().login(provider);
      },
      async answerOAuthPrompt(requestId, value) {
        ensureOAuthService().answerPrompt(requestId, value);
      },
      async cancelOAuthLogin() {
        ensureOAuthService().cancel();
      },
      async listModels(provider) {
        return listModelsForProvider(modelRuntime, provider);
      },
      async getAuthStatus() {
        const providers = WIZARD_PI_PROVIDERS.map((piProviderId) => {
          const abProvider = fromPiProviderId(piProviderId);
          const status = modelRuntime.getProviderAuthStatus(piProviderId);
          return {
            piProviderId,
            abProvider: abProvider ?? ("openai" as SetupConfig["provider"]),
            hasAuth: status.configured,
            authType: status.configured
              ? modelRuntime.isUsingOAuth(piProviderId)
                ? ("oauth" as const)
                : ("api_key" as const)
              : undefined,
          };
        }).filter((p) => p.abProvider);
        return { providers };
      },
      async runSetup(config, mode = "create") {
        if (mode === "import") {
          adoptAbInstance({ config, configPath: defaultConfigPath() });
        } else {
          await createAbInstance({ config, configPath: defaultConfigPath() });
        }
        setupState = { firstRun: false, config };
        await startSession(config.abDirectory, {
          firstSession: mode === "create",
          name: config.name,
          about: config.about,
        });
      },
      async resolvePermission(id, allow) {
        const resolveAnswer = pendingPermissions.get(id);
        pendingPermissions.delete(id);
        resolveAnswer?.(allow);
      },
      async shutdown() {
        await core?.api.shutdown();
        core?.dispose();
        core = undefined;
        lifecycle = undefined;
      },
    },
  });

  frontend = channel.getAPI();

  if (!setupState.firstRun) {
    await startSession(setupState.config.abDirectory);
  }
}

main().catch((err) => {
  // Worker crash surfaces as a process exit; tauri-plugin-js onExit notifies
  // the frontend, which shows a friendly error + restart option (NFR-REL-05).
  console.error("[agent-worker] fatal:", err);
  process.exit(1);
});
