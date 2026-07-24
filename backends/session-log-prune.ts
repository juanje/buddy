// backends/session-log-prune.ts — Session event log retention (NFR-MAINT-01).

import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { APP_LOGS_DIR, SESSION_LOG_RETENTION_DAYS } from "../shared/defaults";

/** Delete .buddy/logs/*.jsonl files older than retentionDays. Returns count removed. */
export function pruneSessionLogs(
  rootDir: string,
  retentionDays = SESSION_LOG_RETENTION_DAYS,
  nowMs = Date.now(),
): number {
  const logsDir = join(rootDir, APP_LOGS_DIR);
  if (!existsSync(logsDir)) return 0;

  const cutoff = nowMs - retentionDays * 86_400_000;
  let removed = 0;

  for (const name of readdirSync(logsDir)) {
    if (!name.endsWith(".jsonl")) continue;
    const filePath = join(logsDir, name);
    const { mtimeMs } = statSync(filePath);
    if (mtimeMs < cutoff) {
      unlinkSync(filePath);
      removed++;
    }
  }

  return removed;
}
