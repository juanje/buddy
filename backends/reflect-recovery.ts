// backends/reflect-recovery.ts — Crash recovery: spawn reflect children for pending logs.

import { findPendingReflects } from "./reflect";
import { spawnReflectChild, type SpawnReflectOptions } from "./reflect-spawn";

export type SpawnReflectFn = (options: SpawnReflectOptions) => number | undefined;

/**
 * Detect reflect-pending logs and spawn background children (non-blocking).
 * Returns spawn options for each child (test contract); PIDs when using the real spawner.
 */
export function runCrashRecoveryCatchUp(
  abDirectory: string,
  spawn: SpawnReflectFn = spawnReflectChild,
): SpawnReflectOptions[] {
  const pending = findPendingReflects(abDirectory);
  const spawned: SpawnReflectOptions[] = [];
  for (const item of pending.slice(0, 3)) {
    const options: SpawnReflectOptions = {
      abDirectory,
      forkedSessionFile: "",
      logPath: item.path,
      mode: "crash-catchup",
    };
    spawn(options);
    spawned.push(options);
  }
  return spawned;
}
