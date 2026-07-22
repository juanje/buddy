// backends/reflect-spawn.ts — Spawn background reflect child process (FR-REFLECT-02/03).

import { fork as cpFork } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SpawnReflectOptions {
  rootDir: string;
  forkedSessionFile: string;
  /** Pending skeleton path (session-end/crash) or empty for checkpoint. */
  logPath: string;
  mode: "session-end" | "checkpoint" | "crash-catchup";
  /** Session-start calendar day for checkpoint daily log (YYYY-MM-DD). */
  checkpointDate?: string;
  /** Local time label for ## Checkpoint HH:MM. */
  checkpointTime?: string;
}

export type SpawnReflectFn = (options: SpawnReflectOptions) => number | undefined;

const CHILD_SCRIPT = join(
  fileURLToPath(import.meta.url),
  "..",
  "reflect-child.ts",
);

/**
 * In a bun-compiled binary, fork() re-executes the full binary (not the child
 * script), which triggers main() → crash recovery → more forks = fork bomb.
 * Detect this and skip spawn entirely; pending skeletons persist for next
 * dev-mode session or future inline-reflect implementation.
 */
function isCompiledBinary(): boolean {
  return process.execPath.includes("/$bunfs/") ||
    process.execPath.endsWith("/agent-worker") ||
    process.execPath.includes("/MacOS/agent-worker");
}

/**
 * Spawn a detached child process that runs the reflect LLM call.
 * The child inherits the environment (auth, PATH) and runs independently.
 * Returns the child PID for logging; the process is unref'd so the parent can exit.
 *
 * In production (compiled sidecar), fork is unsafe — skips spawn and returns
 * undefined. The pending skeleton remains for consolidation or next dev session.
 */
export function spawnReflectChild(options: SpawnReflectOptions): number | undefined {
  if (isCompiledBinary()) {
    console.error(`[reflect-spawn] skip fork in compiled binary (mode=${options.mode})`);
    return undefined;
  }

  const args = [
    options.rootDir,
    options.forkedSessionFile,
    options.logPath,
    options.mode,
  ];
  if (options.mode === "checkpoint") {
    args.push(options.checkpointDate ?? "", options.checkpointTime ?? "");
  }

  const child = cpFork(CHILD_SCRIPT, args, {
    detached: true,
    stdio: "ignore",
    execArgv: ["--import", "tsx"],
  });
  child.unref();
  const pid = child.pid;
  if (pid) {
    console.error(`[reflect-spawn] child pid=${pid} mode=${options.mode}`);
  }
  return pid;
}
