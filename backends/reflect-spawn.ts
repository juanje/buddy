// backends/reflect-spawn.ts — Spawn background reflect child process (FR-REFLECT-02/03).

import { fork as cpFork } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHILD_SCRIPT = join(
  fileURLToPath(import.meta.url),
  "..",
  "reflect-child.ts",
);

export interface SpawnReflectOptions {
  abDirectory: string;
  forkedSessionFile: string;
  logPath: string;
  mode: "session-end" | "incremental" | "crash-catchup";
}

/**
 * Spawn a detached child process that runs the reflect LLM call.
 * The child inherits the environment (auth, PATH) and runs independently.
 * Returns the child PID for logging; the process is unref'd so the parent can exit.
 */
export function spawnReflectChild(options: SpawnReflectOptions): number | undefined {
  const child = cpFork(CHILD_SCRIPT, [
    options.abDirectory,
    options.forkedSessionFile,
    options.logPath,
    options.mode,
  ], {
    detached: true,
    stdio: "ignore",
    execArgv: ["--import", "tsx"],
  });
  child.unref();
  const pid = child.pid;
  if (pid) {
    console.log(`[reflect-spawn] child pid=${pid} mode=${options.mode}`);
  }
  return pid;
}
