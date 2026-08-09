// backends/agent-worker.ts — Worker RPC entry point.
// Not the process entry point in production: the compiled sidecar starts at
// sidecar-entry.ts, which installs polyfills and embedded assets and only then
// imports this module (E12/E13b). In dev, tauri-plugin-js spawns this file
// directly under tsx — which is why something can work in dev and fail in the
// packaged binary.
//
// Detects first run (FR-SETUP-01), creates a real Pi SDK session in the
// configured buddy directory (excludeTools: ["bash"]) and exposes WorkerAPI to
// the frontend over kkrpc stdio transport. Includes permission layer, system
// prompt assembly, auto-commit lifecycle, forked reflect on shutdown, and
// heartbeat scheduler.

// Workaround: Pi SDK's openai-codex.js loads node:crypto and node:http via
// async import() at module init but uses them synchronously in createState().
// In dev (no sidecar-entry.ts), the module isn't loaded until the user clicks
// "Sign in", and the Promises may not have resolved yet — first attempt fails
// with "OpenAI Codex OAuth is only available in Node.js environments".
// Importing the module early forces those Promises to settle before the wizard.
// In prod, sidecar-entry.ts imports it statically via registerBunOAuthFlows().
// Remove when upstream fixes the race (pi-ai openai-codex.js).
import("../node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/auth/oauth/openai-codex.js").catch(() => {});

import { RPCChannel } from "kkrpc";
import { nodeStdioTransport } from "kkrpc/stdio";

import type { FrontendAPI, PromptOptions, WorkerAPI } from "../shared/api";
import type { AllowedEntry } from "./allowed-paths";
import { addAllowedPath, loadAllowedPaths } from "./allowed-paths";
import {
  adoptBuddyInstance,
  createBuddyInstance,
  ensureGitRepository,
} from "./create-buddy";
import {
  assertSetupLocationAllowed,
  defaultBuddyLocation,
  validateLocation,
} from "./location";
import { buildAuthStatus } from "./auth-status";
import { listModelsForProvider } from "./model-listing";
import { resolveSessionModel } from "./model-switch";
import { OAuthService } from "./oauth-service";
import { alignHttpDispatcherWithPi } from "./pi-http-dispatcher";
import { checkPrerequisites } from "./prereqs";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { configureProviderKey, createBuddyModelRuntime } from "./provider-auth";
import { getDueDeferred, removeDueDeferredItems, toDeferredItemViews } from "./deferred";
import { toIsoDay } from "../shared/dates";
import { commitAll } from "./git";
import {
  CONSOLIDATION_RETRY_CEILING,
  FORBID_WORKER_AUTOSTART_ENV,
  GIT_COMMIT_PREFIX,
} from "../shared/defaults";
import { bootSession, augmentPromptWithAttachments } from "./session-boot";
import { recoverStaleSession } from "./crash-recovery";
import { spawnReflectChild } from "./reflect-spawn";
import { detectFirstRun, updateAppConfig } from "./setup";
import { writePiSettings } from "../shared/pi-settings";
import { createWorkerCore } from "./worker-core";
import { startHeartbeat, type HeartbeatHandle } from "./heartbeat";
import { ensureConfigDirMode, globalConfigDir, globalConfigPath } from "./global-config";
import { bootRefreshIfNeeded } from "./boot-refresh";
import { pruneSessionArtifacts } from "./session-log-prune";
import { createUsageTracker, resolveMonthlyBudget, type UsageTracker } from "./usage-tracker";
import { createPromptQueue } from "./prompt-queue";
import { readViewableFile } from "./viewable-file";

/**
 * Fire-and-forget notification to the frontend.
 *
 * A notification that cannot be delivered must never take the worker down: the
 * RPC channel can be gone while a heartbeat tick or a boot step is still in
 * flight. Written out at every call site, this was one forgotten try/catch away
 * from an unhandled throw inside a timer callback.
 */
function notifyFrontend(scope: string, method: string, send: () => void): void {
  try {
    send();
  } catch (err) {
    console.error(`[${scope}] ${method} RPC failed:`, err);
  }
}

export interface WorkerDeps {
  /**
   * Injectable so a test can hold it pending. It reaches the network — the Pi
   * model catalogue — and nothing on the startup path may wait for that.
   */
  createModelRuntime?: () => Promise<ModelRuntime>;
  /** Streams for the RPC transport. Defaults to this process's stdio. */
  streams?: { readable: NodeJS.ReadableStream; writable: NodeJS.WritableStream };
}

export async function main(deps: WorkerDeps = {}): Promise<void> {
  const configDir = globalConfigDir();
  ensureConfigDirMode(configDir); // NFR-SEC-17, before anything is written into it
  bootRefreshIfNeeded(configDir);
  await alignHttpDispatcherWithPi();

  // Started, not awaited. Building the runtime fetches the remote model
  // catalogue, and on 2026-08-01 `pi.dev` began accepting connections without
  // ever answering: every launch cost 15s of blank window, because the RPC
  // channel below did not exist yet. Buddy's own availability must not depend
  // on a third party's (NFR-PERF-02). Each use awaits it; all of them run after
  // the channel is up.
  const modelRuntimeReady = (deps.createModelRuntime ?? createBuddyModelRuntime)();
  // A rejection here is surfaced where it is awaited, but an unawaited promise
  // that rejects first would take the process down.
  modelRuntimeReady.catch(() => {});

  // FR-SETUP-01: on first run there is no buddy directory to open a session in.
  // The channel is created either way (the wizard talks to the worker later);
  // the Pi session only exists when a buddy instance is configured, rooted at its dir.
  let setupState = detectFirstRun(globalConfigPath());

  let core: ReturnType<typeof createWorkerCore> | undefined;
  // FR-CHAT-13: the UI is interactive before the session is. Prompts sent
  // during boot are held here rather than reaching `core?.api.prompt(...)`
  // with `core` undefined, where optional chaining discarded them silently.
  const promptQueue = createPromptQueue();
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
        onBudgetAlert: (status) =>
          notifyFrontend("usage", "onBudgetAlert", () => frontend.onBudgetAlert(status)),
      });
    }
    return usageTracker;
  }

  async function ensureOAuthService(): Promise<OAuthService> {
    if (!oauthService) {
      oauthService = new OAuthService(await modelRuntimeReady, {
        onEvent: (event) => frontend.onOAuthEvent(event),
      });
    }
    return oauthService;
  }

  function stopHeartbeat(): void {
    heartbeat?.stop();
    heartbeat = undefined;
  }

  async function restartHeartbeat(rootDir: string): Promise<void> {
    stopHeartbeat();
    heartbeat = startHeartbeat({
      rootDir,
      modelRuntime: await modelRuntimeReady,
      isStreaming: () => core?.isStreaming() ?? false,
      isBudgetNearLimit: () => ensureUsageTracker().isBudgetNearLimit(),
      onDeferredDue: (items) => {
        console.error(`[heartbeat] onDeferredDue: ${items.length} item(s), forwarding to frontend…`);
        notifyFrontend("heartbeat", "onDeferredDue", () => frontend.onDeferredDue(items));
      },
      onMaintenancePaused: (depth) =>
        notifyFrontend("heartbeat", "onMaintenancePaused", () =>
          frontend.onMaintenancePaused({
            depth,
            consecutiveFailures: CONSOLIDATION_RETRY_CEILING,
          }),
        ),
    });
  }

  async function startSession(
    rootDir: string,
    options?: { firstSession?: boolean; name?: string; about?: string },
  ): Promise<void> {
    if (core) return;

    recoverStaleSession(rootDir, spawnReflectChild);
    pruneSessionArtifacts(rootDir);

    const booted = await bootSession(
      rootDir,
      {
        frontend,
        modelRuntime: await modelRuntimeReady,
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
    await restartHeartbeat(rootDir);
    ensureUsageTracker().checkAndFireAlerts();
    // FR-CHAT-13: tell the frontend before flushing, so the "preparing" notice
    // clears as the queued prompt starts streaming rather than after it ends.
    notifyFrontend("boot", "onSessionReady", () => frontend.onSessionReady());
    // Anything the user typed while the context injection was running goes
    // now, in the order they sent it.
    await promptQueue.ready((text, promptOptions) => booted.core.api.prompt(text, promptOptions));
  }

  const transport = nodeStdioTransport(deps.streams);
  const channel = new RPCChannel<WorkerAPI, FrontendAPI>(transport, {
    expose: {
      async prompt(text: string, options?: PromptOptions) {
        if (!setupState.firstRun && ensureUsageTracker().isBudgetExceeded()) {
          throw new Error("Monthly budget reached");
        }
        const augmented = await augmentPromptWithAttachments(text, sessionAllowedPaths, options);
        await promptQueue.submit(
          augmented.text,
          augmented.images ? { images: augmented.images } : undefined,
        );
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
        return (await ensureOAuthService()).login(provider);
      },
      async answerOAuthPrompt(requestId, value) {
        (await ensureOAuthService()).answerPrompt(requestId, value);
      },
      async cancelOAuthLogin() {
        (await ensureOAuthService()).cancel();
      },
      async listModels(provider) {
        return listModelsForProvider(await modelRuntimeReady, provider);
      },
      async getAuthStatus() {
        return buildAuthStatus(await modelRuntimeReady);
      },
      async runSetup(config, mode = "create") {
        // FR-SETUP-11: the wizard gates on this too, but the worker decides.
        // The frontend chooses what to offer; only the worker decides what is
        // allowed (NFR-SEC-08). Getting it wrong runs cpSync with force: true
        // and `git init` inside a directory full of the user's own files.
        assertSetupLocationAllowed(config.rootDir, mode);
        if (mode === "import") {
          adoptBuddyInstance({ config, configPath: globalConfigPath() });
          await ensureGitRepository(config.rootDir);
        } else {
          await createBuddyInstance({ config, configPath: globalConfigPath() });
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
        const updated = updateAppConfig(patch, globalConfigPath());
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
        const resolved = await resolveSessionModel(await modelRuntimeReady, provider, model);
        await core.api.setModel(resolved);
        writePiSettings(setupState.config.rootDir, { provider, model });
        // Recorded per provider as well as globally: switching back should
        // return to what the user picked, not to the provider's first listing.
        const modelByProvider = { ...setupState.config.modelByProvider, [provider]: model };
        const updated = updateAppConfig({ provider, model, modelByProvider }, globalConfigPath());
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

// Importing this module must not start a worker: the test that drives `main`
// with a pending model runtime imports it (NFR-TEST-02 has the same shape for
// reflect spawning).
if (!process.env[FORBID_WORKER_AUTOSTART_ENV]) {
  main().catch((err) => {
    // Worker crash surfaces as a process exit; tauri-plugin-js onExit notifies
    // the frontend, which shows a friendly error + restart option (NFR-REL-05).
    console.error("[agent-worker] fatal:", err);
    process.exit(1);
  });
}
