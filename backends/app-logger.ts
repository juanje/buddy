// backends/app-logger.ts — Structured app event log (JSONL in .buddy/logs/).

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { APP_LOGS_DIR } from "../shared/defaults";
import { toIsoDay } from "../shared/dates";

export type AppLogEvent =
  | { event: "session_start"; session: string; model?: string }
  | { event: "session_end"; session: string; turns?: number }
  | { event: "turn_end"; session: string; turn: number }
  | { event: "reflect_spawned"; session: string; mode: string }
  | { event: "reflect_complete"; session: string; mode: string; logPath?: string }
  | { event: "reflect_skipped"; session: string; mode: string; reason: string }
  | { event: "reflect_error"; session: string; mode: string; message: string }
  | { event: "consolidation_start"; depth: number }
  | { event: "consolidation_complete"; depth: number }
  | { event: "consolidation_error"; depth: number; error: string; failureCount?: number }
  /** Depth not attempted: in backoff or past the retry ceiling (FR-CONSOL-09). */
  | { event: "consolidation_skipped"; depth: number; reason: string }
  /** Depth reached the retry ceiling and will not be retried (FR-CONSOL-09). */
  | { event: "consolidation_abandoned"; depth: number }
  /** Cascade stopped mid-flight because spend crossed the threshold (FR-COST-05). */
  | { event: "consolidation_budget_stopped"; depth: number }
  | { event: "tool_result"; session: string; tool: string; path?: string; isError: boolean }
  /** FR-GUARD-01: a write/edit destroyed section headings and was reverted. */
  | { event: "heading_guard_revert"; session: string; path: string; lostHeadings?: string[] }
  | { event: "post_consolidation_rename"; from: string; to: string }
  | { event: "post_consolidation_link_repair"; file: string; target: string }
  | { event: "heartbeat_tick"; deferredDue: number; consolidationEvaluated: boolean }
  /** FR-WIKI-05: heartbeat wiki health audit failed (does not block consolidation). */
  | { event: "wiki_health_error"; error: string }
  | { event: "error"; message: string; context?: string };

function appLogPath(rootDir: string, day: string): string {
  return join(rootDir, APP_LOGS_DIR, `${day}.jsonl`);
}

/** Append one JSONL event line to `.buddy/logs/YYYY-MM-DD.jsonl`. */
export function logEvent(rootDir: string, payload: AppLogEvent, now = new Date()): void {
  const day = toIsoDay(now);
  const dir = join(rootDir, APP_LOGS_DIR);
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ ts: now.toISOString(), ...payload }) + "\n";
  appendFileSync(appLogPath(rootDir, day), line, "utf8");
}
