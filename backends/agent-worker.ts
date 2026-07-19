// backends/agent-worker.ts — Worker entry point.
// Spawned by tauri-plugin-js inside the Tauri app. Detects first run
// (FR-SETUP-01), creates a real Pi SDK session in the configured AB directory
// (excludeTools: ["bash"]) and exposes WorkerAPI to the frontend over kkrpc
// stdio transport. Includes permission layer, system prompt assembly,
// auto-commit lifecycle, and forked reflect on shutdown.

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { RPCChannel } from "kkrpc";
import { nodeStdioTransport } from "kkrpc/stdio";

import type { AgentEvent, FrontendAPI, PromptOptions, WorkerAPI } from "../shared/api";
import { adoptAbInstance, createAbInstance } from "./create-ab";
import { detectExistingAuth } from "./detect-auth";
import { defaultAbLocation, validateLocation } from "./location";
import { createPermissionGate } from "./permissions";
import { alignHttpDispatcherWithPi } from "./pi-http-dispatcher";
import { checkPrerequisites } from "./prereqs";
import { runCrashRecoveryCatchUp } from "./reflect-recovery";
import { assembleSystemPrompt } from "./prompt";
import { configureProviderKey } from "./provider-auth";
import { SessionLifecycle } from "./session-lifecycle";
import { defaultConfigPath, detectFirstRun } from "./setup";
import { runWarmHandoff } from "./warm-handoff";
import { createWorkerCore, type PiSessionLike } from "./worker-core";

/** Map Pi AgentSession to the structural subset the worker core needs. */
function asPiSessionLike(session: {
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  readonly isStreaming: boolean;
  dispose(): void;
}): PiSessionLike {
  return {
    prompt: (text) => session.prompt(text),
    abort: () => session.abort(),
    subscribe: (listener) => session.subscribe(listener),
    get isStreaming() {
      return session.isStreaming;
    },
    dispose: () => session.dispose(),
  };
}

async function main(): Promise<void> {
  await alignHttpDispatcherWithPi();

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
  let sessionAllowedPaths = new Set<string>();

  function augmentPromptWithAttachments(text: string, options?: PromptOptions): string {
    if (!options?.attachments?.length) return text;
    for (const path of options.attachments) {
      sessionAllowedPaths.add(resolve(path));
    }
    const header = options.attachments.map((p) => `User attached: ${p}`).join("\n");
    return text.trim() ? `${header}\n\n${text}` : header;
  }

  async function bootSession(
    abDirectory: string,
    options?: { firstSession?: boolean; name?: string; about?: string },
  ): Promise<void> {
    if (core) return;

    if (!existsSync(abDirectory)) {
      frontend.onWorkerError(`AB directory not found: ${abDirectory}`);
      return;
    }

    const spawned = runCrashRecoveryCatchUp(abDirectory);
    for (const item of spawned) {
      console.error("[agent-worker] crash recovery: spawning reflect for", item.logPath);
    }

    const sessionId = randomUUID().slice(0, 8);
    lifecycle = new SessionLifecycle({
      abDirectory,
      sessionId,
    });

    sessionAllowedPaths = new Set<string>();

    const { prompt } = assembleSystemPrompt(abDirectory);
    const resourceLoader = new DefaultResourceLoader({
      cwd: abDirectory,
      agentDir: getAgentDir(),
      systemPromptOverride: () => prompt,
    });
    await resourceLoader.reload();

    const { session } = await createAgentSession({
      cwd: abDirectory,
      resourceLoader,
      sessionManager: SessionManager.create(abDirectory),
      excludeTools: ["bash"],
    });

    lifecycle.setSessionFile((session as unknown as { sessionFile?: string }).sessionFile ?? "");

    const gate = createPermissionGate(
      abDirectory,
      (request) => {
        const id = nextPermissionId++;
        return new Promise<boolean>((resolveAnswer) => {
          pendingPermissions.set(id, resolveAnswer);
          frontend.onPermissionRequest({ ...request, id });
        });
      },
      undefined,
      { skipIdentityPrompt: options?.firstSession === true, sessionAllowedPaths },
    );
    const originalBeforeToolCall = session.agent.beforeToolCall;
    session.agent.beforeToolCall = async (ctx, signal) => {
      const prior = await originalBeforeToolCall?.(ctx, signal);
      if (prior?.block) return prior;
      const blocked = await gate.check(ctx.toolCall.name, ctx.args);
      return blocked ?? prior;
    };

    const sessionLike = asPiSessionLike(session);

    if (options?.firstSession && options.name) {
      await runWarmHandoff(sessionLike, frontend, {
        name: options.name,
        about: options.about,
      });
    }

    core = createWorkerCore(sessionLike, frontend, { lifecycle });
  }

  const transport = nodeStdioTransport();
  const channel = new RPCChannel<WorkerAPI, FrontendAPI>(transport, {
    expose: {
      async prompt(text: string, options?: PromptOptions) {
        await core?.api.prompt(augmentPromptWithAttachments(text, options));
      },
      async abort() {
        await core?.api.abort();
      },
      async getState() {
        if (!core) throw new Error("worker not ready");
        return core.api.getState();
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
      async detectExistingAuth() {
        return detectExistingAuth();
      },
      async runSetup(config, mode = "create") {
        if (mode === "import") {
          adoptAbInstance({ config, configPath: defaultConfigPath() });
        } else {
          await createAbInstance({ config, configPath: defaultConfigPath() });
        }
        setupState = { firstRun: false, config };
        await bootSession(config.abDirectory, {
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
    await bootSession(setupState.config.abDirectory);
  }
}

main().catch((err) => {
  // Worker crash surfaces as a process exit; tauri-plugin-js onExit notifies
  // the frontend, which shows a friendly error + restart option (NFR-REL-05).
  console.error("[agent-worker] fatal:", err);
  process.exit(1);
});
