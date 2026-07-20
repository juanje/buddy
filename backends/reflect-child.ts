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
import { DEFAULT_PI_PROVIDER, REFLECT_SESSIONS_DIR } from "../shared/defaults";
import { fastModelForProvider } from "../src/lib/model-catalog";
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
} from "./reflect";

const SESSION_END_PROMPT = `You are a memory consolidation agent. Analyze this session and produce a structured reflect with these sections:

### Decisions
Decisions made during this session (or "None" if none).

### Tasks captured
What was captured and where it was filed (or "None" if nothing actionable).

### Ideas
Ideas discussed, whether filed or not (or "None").

### Context
What was the session about — topics discussed, tasks worked on, state of things.

### Lessons
Patterns, insights, or corrections learned (or "None").

### Open threads
Things left unresolved, pending, or to follow up on (or "None").

### System observations
Skill, rule, concept, or structure candidates detected (or "None").

If today's daily log already contains ## Checkpoint entries from this session, emphasize activity since the last checkpoint while still producing a complete session summary.

Be concise. Capture substance, not mechanics. Write in English.`;

const CHECKPOINT_PROMPT = `You are a memory encoding agent. Briefly encode the recent segment of this session before context compaction:

### Context
What was happening in this segment of the session.

### Notes
Anything worth remembering from this segment.

Be very concise — this is a checkpoint, not a full reflect. Write in English.`;

function readAbProvider(abDirectory: string): string {
  const settingsPath = join(abDirectory, ".pi", "settings.json");
  if (!existsSync(settingsPath)) return DEFAULT_PI_PROVIDER;
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as { defaultProvider?: string };
    return settings.defaultProvider ?? DEFAULT_PI_PROVIDER;
  } catch {
    return DEFAULT_PI_PROVIDER;
  }
}

async function resolveFastModelOptions(abDirectory: string): Promise<{
  model?: Awaited<ReturnType<ModelRuntime["getModel"]>>;
  thinkingLevel: "minimal";
}> {
  const provider = readAbProvider(abDirectory);
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

const LOCK_RETRY_MS = 500;
const LOCK_MAX_RETRIES = 20;

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
    excludeTools: ["bash", "read", "write", "edit", "ls", "find", "grep"],
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
    const result = collectAssistantText(events);

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
