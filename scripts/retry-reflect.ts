// scripts/retry-reflect.ts — Retry a failed session-end reflect from its saved fork.
//
// Usage:
//   npx tsx scripts/retry-reflect.ts <rootDir> [forked-session-file]
//
// If forked-session-file is omitted, uses the most recent .jsonl in
// <rootDir>/.buddy/reflect-sessions/.
//
// This replays the same codepath as reflect-child.ts runReflect() for
// session-end mode, using the real brain directory and auth credentials.

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { GIT_COMMIT_PREFIX, REFLECT_SESSIONS_DIR } from "../shared/defaults";
import { fastModelForProvider } from "../shared/model-catalog";
import { readPiProvider } from "../shared/pi-settings";
import { logEvent } from "../backends/app-logger";
import { commitAll } from "../backends/git";
import { acquireLock, releaseLock } from "../backends/maintenance";
import { alignHttpDispatcherWithPi } from "../backends/pi-http-dispatcher";
import { collectAssistantText } from "../backends/pi-utils";
import { createBuddyModelRuntime } from "../backends/provider-auth";
import { buddyAgentDir } from "../backends/global-config";
import { buildReflectUserPrompt, extractObservationsSection } from "../backends/reflect-prompts";
import {
  appendReflectObservations,
  finalizeReflectToDailyLog,
  sanitizeReflectOutput,
  updateLogsIndexEntry,
} from "../backends/reflect";
import { recordSessionUsage } from "../backends/usage-tracker";
import { globalConfigDir } from "../backends/global-config";
import { clearSessionPersistence } from "../backends/crash-recovery";
import { toIsoDay } from "../shared/dates";
import type { AgentEvent } from "../shared/api";

function findLatestFork(rootDir: string): string | undefined {
  const dir = join(rootDir, REFLECT_SESSIONS_DIR);
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? join(dir, files[0].name) : undefined;
}

function extractSessionDate(forkFile: string): string {
  const name = basename(forkFile);
  const match = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : toIsoDay(new Date());
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help") {
    console.log(`Usage: npx tsx scripts/retry-reflect.ts <rootDir> [forked-session-file]

Re-runs the session-end reflect using the saved fork file.
If no fork file is specified, uses the most recent one.`);
    process.exit(0);
  }

  const rootDir = args[0];
  if (!existsSync(rootDir)) {
    console.error(`Root dir not found: ${rootDir}`);
    process.exit(1);
  }

  const forkedSessionFile = args[1] ?? findLatestFork(rootDir);
  if (!forkedSessionFile || !existsSync(forkedSessionFile)) {
    console.error(`No forked session file found. Specify one or check ${join(rootDir, REFLECT_SESSIONS_DIR)}`);
    process.exit(1);
  }

  const sessionDate = extractSessionDate(forkedSessionFile);
  const sessionId = `retry-${Date.now()}`;
  const now = new Date();
  const sessionStart = "retry";
  const sessionEnd = now.toTimeString().slice(0, 5);

  console.log(`Root dir:     ${rootDir}`);
  console.log(`Fork file:    ${forkedSessionFile}`);
  console.log(`Session date: ${sessionDate}`);
  console.log(`Mode:         session-end (retry)\n`);

  await alignHttpDispatcherWithPi();

  const forkDir = join(rootDir, REFLECT_SESSIONS_DIR);
  const sm = SessionManager.forkFrom(forkedSessionFile, rootDir, forkDir);

  const resourceLoader = new DefaultResourceLoader({
    cwd: rootDir,
    agentDir: buddyAgentDir(),
    systemPromptOverride: () => undefined,
  });
  await resourceLoader.reload();

  const modelRuntime = await createBuddyModelRuntime();

  console.log("Creating agent session...");

  const { session } = await createAgentSession({
    cwd: rootDir,
    agentDir: buddyAgentDir(),
    resourceLoader,
    sessionManager: sm,
    noTools: "all",
    modelRuntime,
  });

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => {
    events.push(event);
    if (event.type === "text" && typeof event.text === "string") {
      process.stdout.write(event.text);
    }
  });

  console.log("Running reflect prompt...\n");
  const start = Date.now();

  try {
    await session.prompt(buildReflectUserPrompt("session-end"));

    recordSessionUsage(globalConfigDir(), events);

    await commitAll(rootDir, `${GIT_COMMIT_PREFIX} reflect session-end (agent writes)`);

    const raw = collectAssistantText(events);
    const result = raw ? sanitizeReflectOutput(raw) : "";

    if (result) {
      if (!acquireLock(rootDir)) {
        console.error("\nCould not acquire lock for finalization.");
        process.exit(1);
      }
      try {
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
          session: sessionId,
          mode: "session-end",
          logPath: dailyPath,
        });
        clearSessionPersistence(rootDir);
        await commitAll(rootDir, `${GIT_COMMIT_PREFIX} session reflect`);

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`\n\nReflect complete (${elapsed}s). Log: ${dailyPath}`);
      } finally {
        releaseLock(rootDir);
      }
    } else {
      console.error("\nReflect produced empty output.");
    }
  } catch (err) {
    logEvent(rootDir, {
      event: "reflect_error",
      session: sessionId,
      mode: "session-end",
      message: err instanceof Error ? err.message : String(err),
    });
    console.error("\nReflect error:", err);
    process.exit(1);
  } finally {
    unsub();
    session.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
