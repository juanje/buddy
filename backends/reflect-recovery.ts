// backends/reflect-recovery.ts — Crash recovery: spawn reflect children for pending skeletons.

import { CRASH_RECOVERY_MAX } from "../shared/defaults";
import { findPendingReflects, markPendingInProgress } from "./reflect";
import { spawnReflectChild, type SpawnReflectOptions } from "./reflect-spawn";

export type SpawnReflectFn = (options: SpawnReflectOptions) => number | undefined;

/**
 * Detect reflect-pending skeletons and spawn background children (non-blocking).
 * Returns spawn options for each child (test contract); PIDs when using the real spawner.
 *
 * Safety: refuses to run if AB_REFLECT_CHILD is set (prevents exponential
 * recursion when the argv dispatch fails and a reflect child accidentally
 * enters the agent-worker boot path).
 */
export function runCrashRecoveryCatchUp(
  rootDir: string,
  spawn: SpawnReflectFn = spawnReflectChild,
): SpawnReflectOptions[] {
  if (process.env.AB_REFLECT_CHILD === "1") return [];

  const pending = findPendingReflects(rootDir);
  const spawned: SpawnReflectOptions[] = [];
  for (const item of pending.slice(0, CRASH_RECOVERY_MAX)) {
    markPendingInProgress(item.path);
    const options: SpawnReflectOptions = {
      rootDir,
      forkedSessionFile: "",
      logPath: item.path,
      mode: "crash-catchup",
    };
    spawn(options);
    spawned.push(options);
  }
  return spawned;
}
