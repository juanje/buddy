// backends/session-boot.ts — Pi session bootstrap (FR-SETUP, FR-PERM, FR-HEBB).

import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join, resolve } from "node:path";

import { AGENT_TOOLS, EXCLUDED_TOOLS, SESSION_ID_DISPLAY_LENGTH } from "../shared/defaults";
import type { AgentEvent, FrontendAPI, PromptOptions } from "../shared/api";
import { imageMimeType, isImageFormat, isPdfFormat } from "../shared/ingest-formats";
import { logEvent } from "./app-logger";
import { createHebbianTracker } from "./hebbian";
import { createPermissionGate, isDenylistedPath, type PermissionRequest } from "./permissions";
import type { AllowedEntry } from "./allowed-paths";
import { extractPdfText } from "./pdf-extract";
import { assembleSessionContext, assembleSystemPrompt } from "./prompt";
import { injectSessionContext } from "./context-injection";
import { buddyAgentDir, globalConfigDir } from "./global-config";
import { buildSkillTools } from "./skill-tools";
import { buildFetchTools } from "./fetch-url";
import { buildFileTools } from "./file-tools";
import { buildShowFileTools } from "./show-file-tool";
import { SessionLifecycle } from "./session-lifecycle";
import { persistLiveSession } from "./crash-recovery";
import { createWorkerCore, type PiSessionLike, type WorkerCore } from "./worker-core";
import type { UsageTracker } from "./usage-tracker";
import { runWarmHandoff } from "./warm-handoff";

export interface SessionBootContext {
  frontend: FrontendAPI;
  modelRuntime: ModelRuntime;
  requestPermission: (request: Omit<PermissionRequest, "id">) => Promise<boolean>;
  sessionAllowedPaths: Set<string>;
  persistentAllowedPaths: () => AllowedEntry[];
  usageTracker?: UsageTracker;
}

export interface AgentToolsetDeps {
  requestPermission: (request: Omit<PermissionRequest, "id">) => Promise<boolean>;
  showFile: (relPath: string) => void;
  sessionAllowedPaths?: Set<string>;
}

/**
 * The tools a live user session gets, as one value.
 *
 * Extracted so it can be tested, and because `tools` and `customTools` are two
 * lists that have to agree: a custom tool absent from `tools` is registered and
 * never offered to the model, which looks exactly like the model choosing not
 * to call it. Building both from the same array is what makes them agree, and
 * `tests/unit/agent-toolset.test.ts` holds them to it.
 *
 * Consolidation assembles its own set (`consolidation-runner.ts`) — it runs
 * without a user to ask or a window to show anything in.
 */
export function buildAgentToolset(
  rootDir: string,
  deps: AgentToolsetDeps,
): { names: string[]; customTools: ToolDefinition[] } {
  const skillTools = buildSkillTools(join(globalConfigDir(), "prompts"));
  const fetchTools = buildFetchTools(rootDir);
  const fileTools = buildFileTools(rootDir, {
    confirmDelete: (absPath) =>
      deps.requestPermission({ kind: "delete-file", op: "write", path: absPath }),
    askReadPermission: (absPath) =>
      deps.requestPermission({ kind: "outside", op: "read", path: absPath }),
    sessionAllowedPaths: deps.sessionAllowedPaths,
  });
  const showFileTools = buildShowFileTools({ rootDir, showFile: deps.showFile });

  const customTools = [...skillTools, ...fetchTools, ...fileTools, ...showFileTools];
  return {
    names: [...AGENT_TOOLS, ...customTools.map((tool) => tool.name)],
    customTools,
  };
}

export interface BootSessionOptions {
  firstSession?: boolean;
  name?: string;
  about?: string;
  onSessionComplete?: (hadActivity: boolean) => void;
  isBudgetNearLimit?: () => boolean;
}

/** Map Pi AgentSession to the structural subset the worker core needs. */
function asPiSessionLike(session: {
  prompt(text: string, options?: unknown): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  setModel(model: unknown): Promise<void>;
  readonly isStreaming: boolean;
  dispose(): void;
}): PiSessionLike {
  return {
    prompt: (text, options) => session.prompt(text, options),
    abort: () => session.abort(),
    subscribe: (listener) => session.subscribe(listener),
    setModel: (model) => session.setModel(model),
    get isStreaming() {
      return session.isStreaming;
    },
    dispose: () => session.dispose(),
  };
}

export async function augmentPromptWithAttachments(
  text: string,
  sessionAllowedPaths: Set<string>,
  options?: PromptOptions,
): Promise<{ text: string; images?: Array<{ type: "image"; data: string; mimeType: string }> }> {
  if (!options?.attachments?.length) return { text };

  const textBlocks: string[] = [];
  const images: Array<{ type: "image"; data: string; mimeType: string }> = [];

  for (const path of options.attachments) {
    const absPath = resolve(path);
    if (!isDenylistedPath(absPath)) {
      sessionAllowedPaths.add(absPath);
    }
    if (isImageFormat(path)) {
      try {
        const data = readFileSync(path).toString("base64");
        images.push({ type: "image", data, mimeType: imageMimeType(path) });
      } catch {
        textBlocks.push(`User attached: ${path}`);
      }
    } else if (isPdfFormat(path)) {
      const extracted = await extractPdfText(path);
      const name = basename(path);
      if (extracted) {
        textBlocks.push(`<document name="${name}">\n${extracted}\n</document>`);
      } else {
        textBlocks.push(`User attached: ${path}`);
      }
    } else {
      textBlocks.push(`User attached: ${path}`);
    }
  }

  if (textBlocks.length > 0) {
    const header = textBlocks.join("\n\n");
    text = text.trim() ? `${header}\n\n${text}` : header;
  }

  return { text, images: images.length > 0 ? images : undefined };
}

export async function bootSession(
  rootDir: string,
  context: SessionBootContext,
  options?: BootSessionOptions,
): Promise<{ core: WorkerCore; lifecycle: SessionLifecycle } | undefined> {
  if (!existsSync(rootDir)) {
    context.frontend.onWorkerError(`buddy directory not found: ${rootDir}`);
    return undefined;
  }

  const sessionId = randomUUID().slice(0, SESSION_ID_DISPLAY_LENGTH);
  logEvent(rootDir, { event: "session_start", session: sessionId });
  const hebbianTracker = createHebbianTracker(rootDir);
  const lifecycle = new SessionLifecycle({
    rootDir,
    sessionId,
    hebbianTracker,
    onSessionComplete: options?.onSessionComplete,
    isBudgetNearLimit: options?.isBudgetNearLimit,
  });

  context.sessionAllowedPaths.clear();

  const { prompt } = assembleSystemPrompt(rootDir);
  const sessionContext = assembleSessionContext(rootDir);
  const resourceLoader = new DefaultResourceLoader({
    cwd: rootDir,
    agentDir: buddyAgentDir(), // NFR-SEC-19
    systemPromptOverride: () => prompt,
  });
  await resourceLoader.reload();

  const toolset = buildAgentToolset(rootDir, {
    requestPermission: context.requestPermission,
    sessionAllowedPaths: context.sessionAllowedPaths,
    showFile: (relPath) => {
      // A failed push must not fail the tool call: the agent has already been
      // told the file was opened, and a dropped RPC is the frontend's problem,
      // not something to surface as a refusal.
      try {
        context.frontend.onShowFile(relPath);
      } catch (err) {
        console.error("[show_file] onShowFile RPC failed:", err);
      }
    },
  });

  const { session } = await createAgentSession({
    cwd: rootDir,
    // NFR-SEC-19: without this the SDK falls back to getAgentDir(), and its
    // SettingsManager reads the user's ~/.pi/agent/settings.json — their Pi CLI
    // provider, model, thinking level and theme.
    agentDir: buddyAgentDir(),
    resourceLoader,
    sessionManager: SessionManager.create(rootDir),
    excludeTools: [...EXCLUDED_TOOLS],
    tools: toolset.names,
    customTools: toolset.customTools,
    modelRuntime: context.modelRuntime,
  });

  const sessionFilePath = (session as unknown as { sessionFile?: string }).sessionFile ?? "";
  lifecycle.setSessionFile(sessionFilePath);
  persistLiveSession(rootDir, sessionFilePath);

  const gate = createPermissionGate(
    rootDir,
    context.requestPermission,
    undefined,
    {
      skipIdentityPrompt: options?.firstSession === true,
      sessionAllowedPaths: context.sessionAllowedPaths,
      getPersistentAllowedPaths: context.persistentAllowedPaths,
    },
  );
  const originalBeforeToolCall = session.agent.beforeToolCall;
  session.agent.beforeToolCall = async (ctx, signal) => {
    const prior = await originalBeforeToolCall?.(ctx, signal);
    if (prior?.block) return prior;
    const blocked = await gate.check(ctx.toolCall.name, ctx.args);
    return blocked ?? prior;
  };

  const sessionLike = asPiSessionLike(session);

  // Skip context injection for first sessions — personalization is handled
  // by the warm handoff, and there are no logs/deferred to inject.
  const skipInjection = options?.firstSession && sessionContext.personalizationPending;
  if (sessionContext.message && !skipInjection) {
    await injectSessionContext(sessionLike, context.frontend, sessionContext.message);
  }

  // Warm handoff (first session greeting) also runs BEFORE worker core —
  // injectHiddenPrompt manages its own subscriber to show the response.
  if (options?.firstSession && options.name) {
    await runWarmHandoff(sessionLike, context.frontend, {
      name: options.name,
      about: options.about,
    });
  }

  const core = createWorkerCore(sessionLike, context.frontend, {
    lifecycle,
    usageTracker: context.usageTracker,
  });

  return { core, lifecycle };
}
