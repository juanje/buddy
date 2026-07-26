// backends/reflect-spawn.ts — Spawn background reflect child process (FR-REFLECT-02/03).

import { fork as cpFork, spawn as cpSpawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REFLECT_ARGV_FLAG,
  REFLECT_CHILD_ENV_KEY,
  REFLECT_CHILD_ENV_VALUE,
  LEGACY_REFLECT_CHILD_ENV,
} from "../shared/defaults";

export interface SpawnReflectOptions {
  rootDir: string;
  forkedSessionFile: string;
  mode: "session-end" | "checkpoint";
  sessionId: string;
  sessionDate: string;
  sessionStart: string;
  sessionEnd: string;
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

/** True when running inside a bun-compiled binary (production sidecar). */
export function isCompiledBinary(): boolean {
  return typeof (globalThis as any).Bun !== "undefined";
}

function buildReflectArgs(options: SpawnReflectOptions): string[] {
  const args = [
    options.rootDir,
    options.forkedSessionFile,
    options.mode,
    options.sessionId,
    options.sessionDate,
    options.sessionStart,
    options.sessionEnd,
  ];
  if (options.mode === "checkpoint") {
    args.push(options.checkpointDate ?? "", options.checkpointTime ?? "");
  }
  return args;
}

/**
 * Spawn a detached child process that runs the reflect LLM call.
 * The child inherits the environment (auth, PATH) and runs independently.
 * Returns the child PID for logging; the process is unref'd so the parent can exit.
 *
 * Dev: child_process.fork(reflect-child.ts) with tsx.
 * Prod: spawn(process.execPath, ["--reflect", ...]) — same binary, argv dispatch (E13b).
 */
export function spawnReflectChild(options: SpawnReflectOptions): number | undefined {
  if (process.env[REFLECT_CHILD_ENV_KEY] || process.env[LEGACY_REFLECT_CHILD_ENV]) {
    console.error(
      `[reflect-spawn] refusing nested reflect spawn (${REFLECT_CHILD_ENV_KEY} already set)`,
    );
    return undefined;
  }

  const args = buildReflectArgs(options);

  if (isCompiledBinary()) {
    const child = cpSpawn(process.execPath, [REFLECT_ARGV_FLAG, ...args], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, [REFLECT_CHILD_ENV_KEY]: REFLECT_CHILD_ENV_VALUE },
    });
    child.unref();
    const pid = child.pid;
    if (pid) {
      console.error(`[reflect-spawn] sidecar reflect pid=${pid} mode=${options.mode}`);
    }
    return pid;
  }

  const child = cpFork(CHILD_SCRIPT, args, {
    detached: true,
    stdio: "ignore",
    execArgv: ["--import", "tsx"],
    env: { ...process.env, [REFLECT_CHILD_ENV_KEY]: REFLECT_CHILD_ENV_VALUE },
  });
  child.unref();
  const pid = child.pid;
  if (pid) {
    console.error(`[reflect-spawn] child pid=${pid} mode=${options.mode}`);
  }
  return pid;
}
