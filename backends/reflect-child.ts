// backends/reflect-child.ts — Background child process for session reflect (FR-REFLECT-02/03).
// Spawned by the worker via child_process.fork() (dev) or spawn(execPath, ["--reflect", ...]) (prod).
// Args after --reflect flag:
//   rootDir, forkedSessionFile, mode, sessionId, sessionDate, sessionStart, sessionEnd
//   checkpoint mode also: checkpointDate, checkpointTime
// Uses indexOf("--reflect") for position-independent parsing (Bun may prepend extra argv entries).
//
// Modes:
//   "session-end" — full reflect → append to logs/YYYY-MM-DD.md
//   "checkpoint"  — lightweight reflect → append ## Checkpoint to daily log

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buddyAgentDir, globalConfigDir } from "./global-config";
import type { AgentEvent } from "../shared/api";
import {
  GIT_COMMIT_PREFIX,
  isRetryableReflectError,
  LOCK_MAX_RETRIES,
  LOCK_RETRY_MS,
  REFLECT_ARGV_FLAG,
  REFLECT_CHILD_TIMEOUT_MS,
  REFLECT_RETRY_DELAYS_MS,
  REFLECT_SESSIONS_DIR,
} from "../shared/defaults";
import { logEvent } from "./app-logger";
import { resolveFastTierModel } from "./fast-model";
import { commitAll } from "./git";
import { acquireLock, releaseLock } from "./maintenance";
import { alignHttpDispatcherWithPi } from "./pi-http-dispatcher";
import { collectAssistantText } from "./pi-utils";
import { createBuddyModelRuntime } from "./provider-auth";
import {
  appendReflectObservations,
  finalizeCheckpointToDailyLog,
  finalizeReflectToDailyLog,
  sanitizeReflectOutput,
  updateLogsIndexEntry,
} from "./reflect";
import { clearSessionPersistence } from "./crash-recovery";
import { buildReflectUserPrompt, extractObservationsSection } from "./reflect-prompts";
import { recordSessionUsage } from "./usage-tracker";

async function acquireLockWithRetry(rootDir: string): Promise<boolean> {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    if (acquireLock(rootDir)) return true;
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
  }
  return false;
}

function findAssistantErrorMessage(events: AgentEvent[]): string | undefined {
  const failedMessage = events.find(
    (event) => event.type === "message_end"
      && (event as { message?: { stopReason?: string } }).message?.stopReason === "error",
  ) as { message?: { errorMessage?: string } } | undefined;
  return failedMessage?.message?.errorMessage;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runReflect(
  rootDir: string,
  forkedSessionFile: string,
  mode: string,
  sessionId: string,
  sessionDate: string,
  sessionStart: string,
  sessionEnd: string,
  checkpointDate?: string,
  checkpointTime?: string,
): Promise<void> {
  await alignHttpDispatcherWithPi();

  const isCheckpoint = mode === "checkpoint";
  const logSessionId = isCheckpoint ? "checkpoint" : sessionId;

  if (!forkedSessionFile || !existsSync(forkedSessionFile)) {
    logEvent(rootDir, {
      event: "reflect_skipped",
      session: logSessionId,
      mode,
      reason: "missing_forked_session",
    });
    return;
  }

  const forkDir = join(rootDir, REFLECT_SESSIONS_DIR);
  mkdirSync(forkDir, { recursive: true });
  const sm = SessionManager.forkFrom(forkedSessionFile, rootDir, forkDir);

  // Fork-only context: no system prompt injection — the fork already has the conversation.
  const resourceLoader = new DefaultResourceLoader({
    cwd: rootDir,
    agentDir: buddyAgentDir(), // NFR-SEC-19
    systemPromptOverride: () => undefined,
  });
  await resourceLoader.reload();

  const modelRuntime = await createBuddyModelRuntime();

  const fastModelOptions = await resolveFastTierModel(rootDir, modelRuntime, "minimal");

  const { session } = await createAgentSession({
    cwd: rootDir,
    agentDir: buddyAgentDir(), // NFR-SEC-19: keeps SettingsManager off ~/.pi/agent
    resourceLoader,
    sessionManager: sm,
    noTools: "all",
    modelRuntime,
    ...fastModelOptions,
  });

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  try {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= REFLECT_RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        const delayMs = REFLECT_RETRY_DELAYS_MS[attempt - 1];
        logEvent(rootDir, {
          event: "reflect_retry",
          session: logSessionId,
          mode,
          attempt,
          delayMs,
        });
        await sleep(delayMs);
        events.length = 0;
      }

      await session.prompt(buildReflectUserPrompt(mode));
      recordSessionUsage(globalConfigDir(), events);

      const errorMessage = findAssistantErrorMessage(events);
      if (errorMessage) {
        if (isRetryableReflectError(errorMessage) && attempt < REFLECT_RETRY_DELAYS_MS.length) {
          lastError = new Error(errorMessage);
          continue;
        }
        throw new Error(errorMessage);
      }

      lastError = undefined;
      break;
    }

    if (lastError) {
      throw lastError;
    }

    // Commit agent writes immediately — before lock, before finalization.
    await commitAll(rootDir, `${GIT_COMMIT_PREFIX} reflect ${mode} (agent writes)`);

    const raw = collectAssistantText(events);
    const result = raw ? sanitizeReflectOutput(raw) : "";

    if (result) {
      if (!await acquireLockWithRetry(rootDir)) {
        logEvent(rootDir, {
          event: "reflect_skipped",
          session: logSessionId,
          mode,
          reason: "lock_unavailable_for_finalization",
        });
        return;
      }
      try {
        if (isCheckpoint) {
          if (!checkpointDate || !checkpointTime) {
            logEvent(rootDir, {
              event: "reflect_skipped",
              session: logSessionId,
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
            session: logSessionId,
            mode,
            logPath: dailyPath,
          });
        } else {
          // FR-REFLECT-08: the fork has no tools, so it emits observations as
          // a section instead of writing them. The worker files them and keeps
          // them out of the daily log — both files reach future sessions, and
          // the same text in both is noise.
          const { body, observations } = extractObservationsSection(result);
          appendReflectObservations(rootDir, sessionDate, observations);
          const dailyPath = finalizeReflectToDailyLog({
            rootDir,
            sessionDate,
            sessionHeader: `${sessionStart}–${sessionEnd}`,
            sections: body,
          });
          updateLogsIndexEntry(rootDir, sessionDate);
          logEvent(rootDir, {
            event: "reflect_complete",
            session: logSessionId,
            mode,
            logPath: dailyPath,
          });
          clearSessionPersistence(rootDir);
        }
        await commitAll(rootDir, `${GIT_COMMIT_PREFIX} session reflect`);
      } finally {
        releaseLock(rootDir);
      }
    } else {
      logEvent(rootDir, {
        event: "reflect_skipped",
        session: logSessionId,
        mode,
        reason: "empty_llm_result",
      });
    }
  } catch (err) {
    logEvent(rootDir, {
      event: "reflect_error",
      session: logSessionId,
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
  const flagIndex = process.argv.indexOf(REFLECT_ARGV_FLAG);
  const argsAfterFlag = flagIndex >= 0
    ? process.argv.slice(flagIndex + 1)
    : process.argv.slice(2);

  const [
    rootDir,
    forkedSessionFile,
    mode,
    sessionId,
    sessionDate,
    sessionStart,
    sessionEnd,
    checkpointDate,
    checkpointTime,
  ] = argsAfterFlag;

  if (!rootDir || !mode || !sessionId || !sessionDate || !sessionStart || !sessionEnd) {
    console.error("[reflect-child] missing arguments, argv:", process.argv);
    process.exit(1);
  }

  // FR-REFLECT-07: the child is detached and unref'd, so nothing supervises it.
  // Without this, a stalled provider leaves the process alive long after the
  // user closed the app — and nobody sends the SIGTERM the handler below waits
  // for. Unref'd so it never keeps an otherwise-finished child running.
  const watchdog = setTimeout(() => {
    logEvent(rootDir, {
      event: "reflect_error",
      session: mode === "checkpoint" ? "checkpoint" : sessionId,
      mode,
      message: `timed out after ${REFLECT_CHILD_TIMEOUT_MS}ms`,
    });
    console.error(`[reflect-child] timed out after ${REFLECT_CHILD_TIMEOUT_MS}ms`);
    process.exit(1);
  }, REFLECT_CHILD_TIMEOUT_MS);
  watchdog.unref();

  process.on("SIGTERM", () => {
    try {
      execSync(`git add -A && git commit -m '${GIT_COMMIT_PREFIX} reflect interrupted (SIGTERM)' --allow-empty-message`, {
        cwd: rootDir,
        stdio: "ignore",
        timeout: 5000,
      });
    } catch { /* best effort */ }
    process.exit(0);
  });

  try {
    await runReflect(
      rootDir,
      forkedSessionFile,
      mode,
      sessionId,
      sessionDate,
      sessionStart,
      sessionEnd,
      checkpointDate,
      checkpointTime,
    );
  } catch (err) {
    console.error("[reflect-child] error:", err);
    process.exit(1);
  }
}

if (process.env.VITEST !== "true" && process.env.VITEST !== "1") {
  main();
}
