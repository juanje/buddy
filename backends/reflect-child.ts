// backends/reflect-child.ts — Background child process for session reflect (FR-REFLECT-02/03).
// Spawned by the worker via child_process.fork() (dev) or spawn(execPath, ["--reflect", ...]) (prod).
// Receives args via process.argv:
//   [0] node/binary, [1] script/--reflect, [2] rootDir, [3] forkedSessionFile, [4] logPath, [5] mode
//   checkpoint mode also: [6] checkpointDate, [7] checkpointTime
//
// Modes:
//   "session-end"   — full reflect → append to logs/YYYY-MM-DD.md
//   "checkpoint"    — lightweight reflect → append ## Checkpoint to daily log
//   "crash-catchup" — recover pending skeleton without forked session

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentEvent } from "../shared/api";
import { LOCK_MAX_RETRIES, LOCK_RETRY_MS, REFLECT_SESSIONS_DIR } from "../shared/defaults";
import { fastModelForProvider } from "../shared/model-catalog";
import { readPiProvider } from "../shared/pi-settings";
import { logEvent } from "./app-logger";
import { commitAll } from "./git";
import { acquireLock, releaseLock } from "./maintenance";
import { alignHttpDispatcherWithPi } from "./pi-http-dispatcher";
import { collectAssistantText } from "./pi-utils";
import { defaultAuthPath } from "./provider-auth";
import {
  finalizeCheckpointToDailyLog,
  finalizeReflectToDailyLog,
  parseFrontmatter,
  sanitizeReflectOutput,
  updateLogsIndexEntry,
} from "./reflect";
import {
  CHECKPOINT_USER_PROMPT,
  CRASH_CATCHUP_USER_PROMPT_PREFIX,
  REFLECT_USER_PROMPT,
} from "./reflect-prompts";

async function resolveFastModelOptions(rootDir: string): Promise<{
  model?: Awaited<ReturnType<ModelRuntime["getModel"]>>;
  thinkingLevel: "minimal";
}> {
  const provider = readPiProvider(rootDir);
  const fastModelId = fastModelForProvider(provider);
  if (!fastModelId) return { thinkingLevel: "minimal" };

  const runtime = await ModelRuntime.create({
    authPath: defaultAuthPath(),
  });
  let model = runtime.getModel(provider, fastModelId);
  if (!model) {
    const available = await runtime.getAvailable(provider);
    model = available.find((entry) => entry.id === fastModelId);
  }
  if (!model) return { thinkingLevel: "minimal" };
  return { model, thinkingLevel: "minimal" };
}

async function acquireLockWithRetry(rootDir: string): Promise<boolean> {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    if (acquireLock(rootDir)) return true;
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
  }
  return false;
}

function sessionIdFromPath(rootDir: string, targetPath: string): string {
  if (!targetPath) return "checkpoint";
  const fm = parseFrontmatter(readFileSync(targetPath, "utf8"));
  if (fm.session_id) return fm.session_id;
  const base = targetPath.split("/").pop() ?? "";
  return base.replace(/\.md$/, "");
}

function buildUserPrompt(mode: string, targetPath: string): string {
  if (mode === "crash-catchup") {
    const skeleton = targetPath ? readFileSync(targetPath, "utf8") : "";
    return `${CRASH_CATCHUP_USER_PROMPT_PREFIX}${skeleton}`;
  }
  if (mode === "checkpoint") {
    return CHECKPOINT_USER_PROMPT;
  }
  return REFLECT_USER_PROMPT;
}

async function runReflect(
  rootDir: string,
  forkedSessionFile: string,
  targetPath: string,
  mode: string,
  checkpointDate?: string,
  checkpointTime?: string,
): Promise<void> {
  await alignHttpDispatcherWithPi();

  const isCheckpoint = mode === "checkpoint";
  const sessionId = isCheckpoint ? "checkpoint" : sessionIdFromPath(rootDir, targetPath);

  let sm: SessionManager;
  if (forkedSessionFile && existsSync(forkedSessionFile)) {
    const forkDir = join(rootDir, REFLECT_SESSIONS_DIR);
    mkdirSync(forkDir, { recursive: true });
    sm = SessionManager.forkFrom(forkedSessionFile, rootDir, forkDir);
  } else {
    sm = SessionManager.create(rootDir);
  }

  // Fork-only context: no system prompt injection — the fork already has the conversation.
  const resourceLoader = new DefaultResourceLoader({
    cwd: rootDir,
    agentDir: getAgentDir(),
    systemPromptOverride: () => undefined,
  });
  await resourceLoader.reload();

  const fastModelOptions = isCheckpoint ? await resolveFastModelOptions(rootDir) : {};

  const { session } = await createAgentSession({
    cwd: rootDir,
    resourceLoader,
    sessionManager: sm,
    noTools: "all",
    ...fastModelOptions,
  });

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  try {
    const userPrompt = buildUserPrompt(mode, targetPath);
    await session.prompt(userPrompt);
    const raw = collectAssistantText(events);
    const result = raw ? sanitizeReflectOutput(raw) : "";

    if (result) {
      if (!await acquireLockWithRetry(rootDir)) {
        logEvent(rootDir, {
          event: "reflect_skipped",
          session: sessionId,
          mode,
          reason: "lock_unavailable",
        });
        return;
      }
      try {
        if (isCheckpoint) {
          if (!checkpointDate || !checkpointTime) {
            logEvent(rootDir, {
              event: "reflect_skipped",
              session: sessionId,
              mode,
              reason: "missing_checkpoint_metadata",
            });
            return;
          }
          const dailyPath = finalizeCheckpointToDailyLog({
            rootDir,
            date: checkpointDate,
            checkpointTime,
            sections: result,
          });
          logEvent(rootDir, {
            event: "reflect_complete",
            session: sessionId,
            mode,
            logPath: dailyPath,
          });
        } else {
          const skeleton = targetPath ? readFileSync(targetPath, "utf8") : "";
          const dailyPath = finalizeReflectToDailyLog({
            rootDir,
            skeletonPath: targetPath,
            skeletonContent: skeleton,
            sections: result,
          });
          const fm = parseFrontmatter(skeleton);
          const logDate = fm.date ?? new Date().toISOString().slice(0, 10);
          updateLogsIndexEntry(rootDir, logDate);
          logEvent(rootDir, {
            event: "reflect_complete",
            session: sessionId,
            mode,
            logPath: dailyPath,
          });
        }
        await commitAll(rootDir, "ab: session reflect");
      } finally {
        releaseLock(rootDir);
      }
    } else {
      logEvent(rootDir, {
        event: "reflect_skipped",
        session: sessionId,
        mode,
        reason: "empty_llm_result",
      });
    }
  } catch (err) {
    logEvent(rootDir, {
      event: "reflect_error",
      session: sessionId,
      mode,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    unsub();
    session.dispose();
  }
}

async function main(): Promise<void> {
  const [, , rootDir, forkedSessionFile, logPath, mode, checkpointDate, checkpointTime] =
    process.argv;
  if (!rootDir || !mode) {
    console.error("[reflect-child] missing arguments");
    process.exit(1);
  }
  if (mode !== "checkpoint" && !logPath) {
    console.error("[reflect-child] missing logPath for mode", mode);
    process.exit(1);
  }

  try {
    await runReflect(
      rootDir,
      forkedSessionFile,
      logPath,
      mode,
      checkpointDate,
      checkpointTime,
    );
  } catch (err) {
    console.error("[reflect-child] error:", err);
    process.exit(1);
  }
}

main();
