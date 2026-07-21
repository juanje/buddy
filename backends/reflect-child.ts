// backends/reflect-child.ts — Background child process for session reflect (FR-REFLECT-02/03).
// Spawned by the worker via child_process.fork(). Receives args via process.argv:
//   [0] node, [1] script, [2] abDirectory, [3] forkedSessionFile, [4] logPath, [5] mode
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
import { EXCLUDED_TOOLS, AGENT_TOOLS, LOCK_MAX_RETRIES, LOCK_RETRY_MS, REFLECT_SESSIONS_DIR } from "../shared/defaults";
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
  rebuildLogsIndex,
  sanitizeReflectOutput,
} from "./reflect";
import { CHECKPOINT_PROMPT, SESSION_END_PROMPT } from "./reflect-prompts";

async function resolveFastModelOptions(abDirectory: string): Promise<{
  model?: Awaited<ReturnType<ModelRuntime["getModel"]>>;
  thinkingLevel: "minimal";
}> {
  const provider = readPiProvider(abDirectory);
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

async function acquireLockWithRetry(abDirectory: string): Promise<boolean> {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    if (acquireLock(abDirectory)) return true;
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
  }
  return false;
}

function sessionIdFromPath(abDirectory: string, targetPath: string): string {
  if (!targetPath) return "checkpoint";
  const fm = parseFrontmatter(readFileSync(targetPath, "utf8"));
  if (fm.session_id) return fm.session_id;
  const base = targetPath.split("/").pop() ?? "";
  return base.replace(/\.md$/, "");
}

async function runReflect(
  abDirectory: string,
  forkedSessionFile: string,
  targetPath: string,
  mode: string,
  checkpointDate?: string,
  checkpointTime?: string,
): Promise<void> {
  await alignHttpDispatcherWithPi();

  const isCheckpoint = mode === "checkpoint";
  const systemPrompt = isCheckpoint ? CHECKPOINT_PROMPT : SESSION_END_PROMPT;
  const sessionId = isCheckpoint ? "checkpoint" : sessionIdFromPath(abDirectory, targetPath);

  let sm: SessionManager;
  if (forkedSessionFile && existsSync(forkedSessionFile)) {
    const forkDir = join(abDirectory, REFLECT_SESSIONS_DIR);
    mkdirSync(forkDir, { recursive: true });
    sm = SessionManager.forkFrom(forkedSessionFile, abDirectory, forkDir);
  } else {
    sm = SessionManager.create(abDirectory);
  }

  const resourceLoader = new DefaultResourceLoader({
    cwd: abDirectory,
    agentDir: getAgentDir(),
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const fastModelOptions = isCheckpoint ? await resolveFastModelOptions(abDirectory) : {};

  const { session } = await createAgentSession({
    cwd: abDirectory,
    resourceLoader,
    sessionManager: sm,
    excludeTools: [...EXCLUDED_TOOLS, ...AGENT_TOOLS],
    ...fastModelOptions,
  });

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  try {
    const skeleton = targetPath ? readFileSync(targetPath, "utf8") : "";
    const userPrompt = mode === "crash-catchup"
      ? `Process this session skeleton into a reflect:\n\n${skeleton}`
      : isCheckpoint
        ? "Encode this session segment before compaction. What happened and what's worth keeping?"
        : "Reflect on this session. What was discussed, decided, learned? What's open?";
    await session.prompt(userPrompt);
    const raw = collectAssistantText(events);
    const result = raw ? sanitizeReflectOutput(raw) : "";

    if (result) {
      if (!await acquireLockWithRetry(abDirectory)) {
        logEvent(abDirectory, {
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
            logEvent(abDirectory, {
              event: "reflect_skipped",
              session: sessionId,
              mode,
              reason: "missing_checkpoint_metadata",
            });
            return;
          }
          const dailyPath = finalizeCheckpointToDailyLog({
            abDirectory,
            date: checkpointDate,
            checkpointTime,
            sections: result,
          });
          logEvent(abDirectory, {
            event: "reflect_complete",
            session: sessionId,
            mode,
            logPath: dailyPath,
          });
        } else {
          const dailyPath = finalizeReflectToDailyLog({
            abDirectory,
            skeletonPath: targetPath,
            skeletonContent: skeleton,
            sections: result,
          });
          rebuildLogsIndex(abDirectory);
          logEvent(abDirectory, {
            event: "reflect_complete",
            session: sessionId,
            mode,
            logPath: dailyPath,
          });
        }
        await commitAll(abDirectory, "ab: session reflect");
      } finally {
        releaseLock(abDirectory);
      }
    } else {
      logEvent(abDirectory, {
        event: "reflect_skipped",
        session: sessionId,
        mode,
        reason: "empty_llm_result",
      });
    }
  } catch (err) {
    logEvent(abDirectory, {
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
  const [, , abDirectory, forkedSessionFile, logPath, mode, checkpointDate, checkpointTime] =
    process.argv;
  if (!abDirectory || !mode) {
    console.error("[reflect-child] missing arguments");
    process.exit(1);
  }
  if (mode !== "checkpoint" && !logPath) {
    console.error("[reflect-child] missing logPath for mode", mode);
    process.exit(1);
  }

  try {
    await runReflect(
      abDirectory,
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
