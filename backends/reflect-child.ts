// backends/reflect-child.ts — Background child process for session reflect (FR-REFLECT-02/03).
// Spawned by the worker via child_process.fork(). Receives args via process.argv:
//   [0] node, [1] script, [2] abDirectory, [3] forkedSessionFile, [4] logPath, [5] mode
//
// Modes:
//   "session-end"   — full reflect (Decisions, Lessons, Context, Open threads)
//   "incremental"   — lightweight encoding (Tasks, Context, Notes)
//   "crash-catchup" — recover pending reflects from skeleton (fallback)

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { existsSync, readFileSync } from "node:fs";
import type { AgentEvent } from "../shared/api";
import { commitAll } from "./git";
import { alignHttpDispatcherWithPi } from "./pi-http-dispatcher";
import { collectAssistantText } from "./pi-utils";
import { markReflectComplete, rebuildLogsIndex } from "./reflect";

const SESSION_END_PROMPT = `You are a memory consolidation agent. Analyze this session and produce a structured reflect with these sections:

### Decisions
Decisions made during this session (or "None" if none).

### Lessons
Patterns, insights, or corrections learned (or "None").

### Context
What was the session about — topics discussed, tasks worked on, state of things.

### Open threads
Things left unresolved, pending, or to follow up on (or "None").

Be concise. Capture substance, not mechanics. Write in the user's language.`;

const INCREMENTAL_PROMPT = `You are a memory encoding agent. Briefly encode this session segment:

### Tasks
Actions taken or discussed.

### Context
What was happening at this point in the session.

### Notes
Anything worth remembering from this segment.

Be very concise — this is an incremental snapshot, not a full reflect.`;

async function runReflect(
  abDirectory: string,
  forkedSessionFile: string,
  logPath: string,
  mode: string,
): Promise<void> {
  await alignHttpDispatcherWithPi();

  const systemPrompt = mode === "incremental" ? INCREMENTAL_PROMPT : SESSION_END_PROMPT;

  let sm: ReturnType<typeof SessionManager.open>;
  if (existsSync(forkedSessionFile)) {
    sm = SessionManager.open(forkedSessionFile, undefined, abDirectory);
  } else {
    sm = SessionManager.create(abDirectory);
  }

  const resourceLoader = new DefaultResourceLoader({
    cwd: abDirectory,
    agentDir: getAgentDir(),
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: abDirectory,
    resourceLoader,
    sessionManager: sm,
    excludeTools: ["bash"],
  });

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  try {
    const userPrompt = mode === "crash-catchup"
      ? `Process this session skeleton into a reflect:\n\n${readFileSync(logPath, "utf8")}`
      : "Reflect on this session. What was discussed, decided, learned? What's open?";
    await session.prompt(userPrompt);
    const result = collectAssistantText(events);

    if (result) {
      markReflectComplete(logPath, result);
      rebuildLogsIndex(abDirectory);
      await commitAll(abDirectory, "ab: session reflect");
    }
  } finally {
    unsub();
    session.dispose();
  }
}

async function main(): Promise<void> {
  const [, , abDirectory, forkedSessionFile, logPath, mode] = process.argv;
  if (!abDirectory || !logPath || !mode) {
    console.error("[reflect-child] missing arguments");
    process.exit(1);
  }
  try {
    await runReflect(abDirectory, forkedSessionFile, logPath, mode);
  } catch (err) {
    console.error("[reflect-child] error:", err);
    process.exit(1);
  }
}

main();
