// backends/session-log-prune.ts — Retention for machine-generated session
// artifacts (NFR-MAINT-01, NFR-MAINT-02).

import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import {
  APP_LOGS_DIR,
  REFLECT_FORK_RETENTION_DAYS,
  REFLECT_SESSIONS_DIR,
  SESSION_LOG_RETENTION_DAYS,
} from "../shared/defaults";
import { MS_PER_DAY } from "../shared/dates";

function pruneOlderThan(
  dir: string,
  suffix: string,
  retentionDays: number,
  nowMs: number,
): number {
  if (!existsSync(dir)) return 0;
  const cutoff = nowMs - retentionDays * MS_PER_DAY;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(suffix)) continue;
    const filePath = join(dir, name);
    try {
      if (statSync(filePath).mtimeMs < cutoff) {
        unlinkSync(filePath);
        removed++;
      }
    } catch {
      // Vanished or unreadable — housekeeping never fails a boot.
    }
  }
  return removed;
}

/** Delete .buddy/logs/*.jsonl files older than retentionDays. Returns count removed. */
export function pruneSessionLogs(
  rootDir: string,
  retentionDays = SESSION_LOG_RETENTION_DAYS,
  nowMs = Date.now(),
): number {
  return pruneOlderThan(join(rootDir, APP_LOGS_DIR), ".jsonl", retentionDays, nowMs);
}

/**
 * Delete forked session files older than retentionDays (NFR-MAINT-02).
 *
 * One fork is created per session and per checkpoint, and each holds the full
 * conversation transcript in plain text. Nothing pruned them before, so they
 * accumulated for the life of the install. NFR-REL-02 keeps them as a
 * manual-recovery window for a reflect that failed; a week is that window, not
 * forever.
 */
export function pruneReflectForks(
  rootDir: string,
  retentionDays = REFLECT_FORK_RETENTION_DAYS,
  nowMs = Date.now(),
): number {
  return pruneOlderThan(join(rootDir, REFLECT_SESSIONS_DIR), ".jsonl", retentionDays, nowMs);
}

/** Every retention pass the app runs, in one call. */
export function pruneSessionArtifacts(rootDir: string, nowMs = Date.now()): number {
  return pruneSessionLogs(rootDir, SESSION_LOG_RETENTION_DAYS, nowMs) +
    pruneReflectForks(rootDir, REFLECT_FORK_RETENTION_DAYS, nowMs);
}
