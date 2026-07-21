// backends/session-boot.ts — Pi session bootstrap (FR-SETUP, FR-PERM, FR-HEBB).

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";

import type { AgentEvent, FrontendAPI, PromptOptions } from "../shared/api";
import { imageMimeType, isImageFormat, isPdfFormat } from "../shared/ingest-formats";
import { logEvent } from "./app-logger";
import { createHebbianTracker } from "./hebbian";
import { createPermissionGate, isDenylistedPath, type PermissionRequest } from "./permissions";
import type { AllowedEntry } from "./allowed-paths";
import { extractPdfText } from "./pdf-extract";
import { assembleSystemPrompt } from "./prompt";
import { runCrashRecoveryCatchUp } from "./reflect-recovery";
import { SessionLifecycle } from "./session-lifecycle";
import { runWarmHandoff } from "./warm-handoff";
import { createWorkerCore, type PiSessionLike, type WorkerCore } from "./worker-core";

export interface SessionBootContext {
  frontend: FrontendAPI;
  modelRuntime: ModelRuntime;
  requestPermission: (request: Omit<PermissionRequest, "id">) => Promise<boolean>;
  sessionAllowedPaths: Set<string>;
  persistentAllowedPaths: AllowedEntry[];
}

export interface BootSessionOptions {
  firstSession?: boolean;
  name?: string;
  about?: string;
}

/** Map Pi AgentSession to the structural subset the worker core needs. */
function asPiSessionLike(session: {
  prompt(text: string, options?: unknown): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  readonly isStreaming: boolean;
  dispose(): void;
}): PiSessionLike {
  return {
    prompt: (text, options) => session.prompt(text, options),
    abort: () => session.abort(),
    subscribe: (listener) => session.subscribe(listener),
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
  abDirectory: string,
  context: SessionBootContext,
  options?: BootSessionOptions,
): Promise<{ core: WorkerCore; lifecycle: SessionLifecycle } | undefined> {
  if (!existsSync(abDirectory)) {
    context.frontend.onWorkerError(`AB directory not found: ${abDirectory}`);
    return undefined;
  }

  const spawned = runCrashRecoveryCatchUp(abDirectory);
  for (const item of spawned) {
    console.error("[agent-worker] crash recovery: spawning reflect for", item.logPath);
  }

  const sessionId = randomUUID().slice(0, 8);
  logEvent(abDirectory, { event: "session_start", session: sessionId });
  const hebbianTracker = createHebbianTracker(abDirectory);
  const lifecycle = new SessionLifecycle({
    abDirectory,
    sessionId,
    hebbianTracker,
  });

  context.sessionAllowedPaths.clear();

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
    tools: ["read", "write", "edit", "grep", "find", "ls"],
    modelRuntime: context.modelRuntime,
  });

  lifecycle.setSessionFile((session as unknown as { sessionFile?: string }).sessionFile ?? "");

  const gate = createPermissionGate(
    abDirectory,
    context.requestPermission,
    undefined,
    {
      skipIdentityPrompt: options?.firstSession === true,
      sessionAllowedPaths: context.sessionAllowedPaths,
      persistentAllowedPaths: context.persistentAllowedPaths,
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
  const core = createWorkerCore(sessionLike, context.frontend, { lifecycle });

  if (options?.firstSession && options.name) {
    await runWarmHandoff(sessionLike, context.frontend, {
      name: options.name,
      about: options.about,
    });
  }

  return { core, lifecycle };
}
