// backends/agent-worker.ts — Worker entry point.
// Spawned by tauri-plugin-js inside the Tauri app. Detects first run
// (FR-SETUP-01), creates a real Pi SDK session in the configured buddy directory
// (excludeTools: ["bash"]) and exposes WorkerAPI to the frontend over kkrpc
// stdio transport. Includes permission layer, system prompt assembly,
// auto-commit lifecycle, forked reflect on shutdown, and heartbeat scheduler.

import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { RPCChannel } from "kkrpc";
import { nodeStdioTransport } from "kkrpc/stdio";

import type {
  FrontendAPI,
  PromptOptions,
  SetupConfig,
  WorkerAPI,
} from "../shared/api";
import type { AllowedEntry } from "./allowed-paths";
import { addAllowedPath, loadAllowedPaths } from "./allowed-paths";
import { adoptBuddyInstance, createBuddyInstance } from "./create-buddy";
import { defaultBuddyLocation, validateLocation } from "./location";
import { listModelsForProvider } from "./model-listing";
import { resolveSessionModel } from "./model-switch";
import { OAuthService } from "./oauth-service";
import { alignHttpDispatcherWithPi } from "./pi-http-dispatcher";
import { checkPrerequisites } from "./prereqs";
import { configureProviderKey, defaultAuthPath } from "./provider-auth";
import {
  fromPiProviderId,
  WIZARD_PI_PROVIDERS,
} from "./provider-mapping";
import { getDueDeferred, removeDueDeferredItems, toDeferredItemViews } from "./deferred";
import { toIsoDay } from "../shared/dates";
import { commitAll } from "./git";
import { GIT_COMMIT_PREFIX } from "../shared/defaults";
import { bootSession, augmentPromptWithAttachments } from "./session-boot";
import { recoverStaleSession } from "./crash-recovery";
import { spawnReflectChild } from "./reflect-spawn";
import { defaultConfigPath, detectFirstRun, updateAppConfig } from "./setup";
import { writePiSettings } from "../shared/pi-settings";
import { createWorkerCore } from "./worker-core";
import { startHeartbeat, type HeartbeatHandle } from "./heartbeat";
import { globalConfigDir } from "./global-config";
import { bootRefreshIfNeeded } from "./boot-refresh";
import { pruneSessionLogs } from "./session-log-prune";
import { createUsageTracker, resolveMonthlyBudget, type UsageTracker } from "./usage-tracker";
import { readViewableFile } from "./viewable-file";

async function main(): Promise<void> {
  const configDir = globalConfigDir();
  bootRefreshIfNeeded(configDir);
  await alignHttpDispatcherWithPi();

  const authPath = defaultAuthPath();
  const modelRuntime = await ModelRuntime.create({ authPath });

  // FR-SETUP-01: on first run there is no buddy directory to open a session in.
  // The channel is created either way (the wizard talks to the worker later);
  // the Pi session only exists when a buddy instance is configured, rooted at its dir.
  let setupState = detectFirstRun(defaultConfigPath());

  let core: ReturnType<typeof createWorkerCore> | undefined;
  let heartbeat: HeartbeatHandle | undefined;
  // Definite assignment: set right after the channel is created below, and
  // bootSession only runs after that.
  let frontend!: FrontendAPI;

  // Pending permission questions: id → resolver (FR-PERM-07). The tool call
  // awaits inside the beforeToolCall hook until the user answers in the chat.
  const pendingPermissions = new Map<number, (allow: boolean) => void>();
  let nextPermissionId = 1;
  const sessionAllowedPaths = new Set<string>();
  let persistentAllowedPaths: AllowedEntry[] = loadAllowedPaths(configDir);

  let oauthService: OAuthService | undefined;
  let usageTracker: UsageTracker | undefined;

  function getBudgetLimit(): number | null {
    if (setupState.firstRun) return null;
    return resolveMonthlyBudget(setupState.config);
  }

  function ensureUsageTracker(): UsageTracker {
    if (!usageTracker) {
      usageTracker = createUsageTracker(configDir, {
        getBudget: getBudgetLimit,
        onBudgetAlert: (status) => {
          try {
            frontend.onBudgetAlert(status);
          } catch (err) {
            console.error("[usage] onBudgetAlert RPC failed:", err);
          }
        },
      });
    }
    return usageTracker;
  }

  function ensureOAuthService(): OAuthService {
    if (!oauthService) {
      oauthService = new OAuthService(modelRuntime, {
        onEvent: (event) => frontend.onOAuthEvent(event),
      });
    }
    return oauthService;
  }

  function stopHeartbeat(): void {
    heartbeat?.stop();
    heartbeat = undefined;
  }

  function startHeartbeatForAb(rootDir: string): void {
    stopHeartbeat();
    heartbeat = startHeartbeat({
      rootDir,
      modelRuntime,
      isStreaming: () => core?.isStreaming() ?? false,
      isBudgetNearLimit: () => ensureUsageTracker().isBudgetNearLimit(),
      onDeferredDue: (items) => {
        console.error(`[heartbeat] onDeferredDue: ${items.length} item(s), forwarding to frontend…`);
        try {
          frontend.onDeferredDue(items);
        } catch (err) {
          console.error("[heartbeat] onDeferredDue RPC failed:", err);
        }
      },
    });
  }

  async function startSession(
    rootDir: string,
    options?: { firstSession?: boolean; name?: string; about?: string },
  ): Promise<void> {
    if (core) return;

    recoverStaleSession(rootDir, spawnReflectChild);
    pruneSessionLogs(rootDir);

    const booted = await bootSession(
      rootDir,
      {
        frontend,
        modelRuntime,
        sessionAllowedPaths,
        persistentAllowedPaths: () => persistentAllowedPaths,
        usageTracker: ensureUsageTracker(),
        requestPermission: (request) => {
          const id = nextPermissionId++;
          return new Promise<boolean>((resolveAnswer) => {
            pendingPermissions.set(id, resolveAnswer);
            frontend.onPermissionRequest({ ...request, id });
          });
        },
      },
      {
        ...options,
        onSessionComplete: (hadActivity) => heartbeat?.incrementSessionCounter(hadActivity),
        isBudgetNearLimit: () => ensureUsageTracker().isBudgetNearLimit(),
      },
    );
    if (!booted) return;
    core = booted.core;
    startHeartbeatForAb(rootDir);
    ensureUsageTracker().checkAndFireAlerts();
  }

  const transport = nodeStdioTransport();
  const channel = new RPCChannel<WorkerAPI, FrontendAPI>(transport, {
    expose: {
      async prompt(text: string, options?: PromptOptions) {
        if (!setupState.firstRun && ensureUsageTracker().isBudgetExceeded()) {
          throw new Error("Monthly budget reached");
        }
        const augmented = await augmentPromptWithAttachments(text, sessionAllowedPaths, options);
        await core?.api.prompt(augmented.text, augmented.images ? { images: augmented.images } : undefined);
      },
      async abort() {
        await core?.api.abort();
      },
      async getDeferredItems() {
        if (setupState.firstRun) return [];
        const today = toIsoDay(new Date());
        return toDeferredItemViews(getDueDeferred(setupState.config.rootDir), today);
      },
      async dismissDeferredItems() {
        if (setupState.firstRun) return;
        removeDueDeferredItems(setupState.config.rootDir);
        await commitAll(setupState.config.rootDir, `${GIT_COMMIT_PREFIX} dismiss deferred reminders`);
      },
      async getSetupState() {
        return setupState;
      },
      async checkPrerequisites() {
        return checkPrerequisites();
      },
      async getDefaultLocation() {
        return defaultBuddyLocation();
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
          const buddyProvider = fromPiProviderId(piProviderId);
          const status = modelRuntime.getProviderAuthStatus(piProviderId);
          return {
            piProviderId,
            buddyProvider: buddyProvider ?? ("openai" as SetupConfig["provider"]),
            hasAuth: status.configured,
            authType: status.configured
              ? modelRuntime.isUsingOAuth(piProviderId)
                ? ("oauth" as const)
                : ("api_key" as const)
              : undefined,
          };
        }).filter((p) => p.buddyProvider);
        return { providers };
      },
      async runSetup(config, mode = "create") {
        if (mode === "import") {
          adoptBuddyInstance({ config, configPath: defaultConfigPath() });
        } else {
          await createBuddyInstance({ config, configPath: defaultConfigPath() });
        }
        setupState = { firstRun: false, config };
        await startSession(config.rootDir, {
          firstSession: mode === "create",
          name: config.name,
          about: config.about,
        });
      },
      async resolvePermission(id, allow, persist) {
        const resolveAnswer = pendingPermissions.get(id);
        pendingPermissions.delete(id);
        if (allow && persist) {
          persistentAllowedPaths = addAllowedPath(configDir, persist);
        }
        resolveAnswer?.(allow);
      },
      async updateConfig(patch) {
        if (setupState.firstRun) {
          throw new Error("App is not configured");
        }
        const updated = updateAppConfig(patch, defaultConfigPath());
        setupState = { firstRun: false, config: updated };
        if (patch.monthlyBudget !== undefined) {
          usageTracker?.resetSessionAlertDedup();
          usageTracker?.checkAndFireAlerts();
        }
      },
      async changeModel(provider, model) {
        if (setupState.firstRun) {
          throw new Error("App is not configured");
        }
        if (!core) {
          throw new Error("No active session");
        }
        const resolved = await resolveSessionModel(modelRuntime, provider, model);
        await core.api.setModel(resolved);
        writePiSettings(setupState.config.rootDir, { provider, model });
        const updated = updateAppConfig({ provider, model }, defaultConfigPath());
        setupState = { firstRun: false, config: updated };
      },
      async getUsage() {
        if (setupState.firstRun) {
          throw new Error("App is not configured");
        }
        return ensureUsageTracker().getUsageReport();
      },
      async readViewableFile(href: string) {
        if (setupState.firstRun) {
          throw new Error("App is not configured");
        }
        return readViewableFile(setupState.config.rootDir, href);
      },
      async shutdown() {
        await core?.api.shutdown();
        stopHeartbeat();
        core?.dispose();
        core = undefined;
      },
    },
  });

  frontend = channel.getAPI();

  if (!setupState.firstRun) {
    await startSession(setupState.config.rootDir);
  }
}

main().catch((err) => {
  // Worker crash surfaces as a process exit; tauri-plugin-js onExit notifies
  // the frontend, which shows a friendly error + restart option (NFR-REL-05).
  console.error("[agent-worker] fatal:", err);
  process.exit(1);
});
