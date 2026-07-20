// backends/app-logger.ts — Structured app event log (JSONL in .ab-app/logs/).

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { APP_LOGS_DIR } from "../shared/defaults";
import { toIsoDay } from "../shared/dates";

export type AppLogEvent =
  | { event: "session_start"; session: string; model?: string }
  | { event: "session_end"; session: string; turns?: number }
  | { event: "turn_end"; session: string; turn: number }
  | { event: "reflect_spawned"; session: string; mode: string; pendingPath?: string }
  | { event: "reflect_complete"; session: string; mode: string; logPath?: string }
  | { event: "reflect_skipped"; session: string; mode: string; reason: string }
  | { event: "reflect_error"; session: string; mode: string; message: string }
  | { event: "error"; message: string; context?: string };

function appLogPath(abDirectory: string, day: string): string {
  return join(abDirectory, APP_LOGS_DIR, `${day}.jsonl`);
}

/** Append one JSONL event line to `.ab-app/logs/YYYY-MM-DD.jsonl`. */
export function logEvent(abDirectory: string, payload: AppLogEvent, now = new Date()): void {
  const day = toIsoDay(now);
  const dir = join(abDirectory, APP_LOGS_DIR);
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ ts: now.toISOString(), ...payload }) + "\n";
  appendFileSync(appLogPath(abDirectory, day), line, "utf8");
}
