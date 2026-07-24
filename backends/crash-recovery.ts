// backends/crash-recovery.ts — Session path persistence and crash recovery (FR-REFLECT-05).

import { formatLocalTime, toIsoDay } from "../shared/dates";
import {
  loadConsolidationState,
  saveConsolidationState,
} from "../shared/consolidation-state";
import type { SpawnReflectFn } from "./reflect-spawn";

/** Persist live session path at session create (zero LLM cost). */
export function persistLiveSession(rootDir: string, sessionFile: string): void {
  const state = loadConsolidationState(rootDir);
  state.liveSessionFile = sessionFile || null;
  state.reflectPending = false;
  saveConsolidationState(rootDir, state);
}

/** Mark that session-end reflect was requested but may not have completed (crash window). */
export function markReflectPending(rootDir: string): void {
  const state = loadConsolidationState(rootDir);
  state.reflectPending = true;
  saveConsolidationState(rootDir, state);
}

/** Clear persistence fields after reflect completes or recovery spawn. */
export function clearSessionPersistence(rootDir: string): void {
  const state = loadConsolidationState(rootDir);
  state.reflectPending = false;
  state.liveSessionFile = null;
  saveConsolidationState(rootDir, state);
}

/**
 * On boot: if previous session ended without reflect completing, fork and spawn
 * session-end reflect before creating a new live session.
 */
export function recoverStaleSession(
  rootDir: string,
  spawnReflect: SpawnReflectFn,
): boolean {
  const state = loadConsolidationState(rootDir);
  if (!state.reflectPending || !state.liveSessionFile) return false;

  const now = new Date();
  spawnReflect({
    rootDir,
    forkedSessionFile: state.liveSessionFile,
    mode: "session-end",
    sessionId: "recovered",
    sessionDate: toIsoDay(now),
    sessionStart: "??:??",
    sessionEnd: formatLocalTime(now.toISOString()),
  });

  clearSessionPersistence(rootDir);
  return true;
}
