// backends/tasks/task-result.ts — TaskActionResult → tool text.

import type { TaskActionResult } from "../../shared/task-types";

export function taskResultToText(result: TaskActionResult): string {
  if (!result.ok) {
    return result.suggestion ? `${result.error}. ${result.suggestion}` : result.error;
  }
  const parts = [result.message];
  if (result.nextClearedForArea) {
    parts.push(`Next action cleared for @${result.nextClearedForArea || "general"}.`);
  }
  if (result.noNextForArea) {
    parts.push(`No next action set for @${result.noNextForArea || "general"} — consider set_next.`);
  }
  if (result.list) {
    parts.push(JSON.stringify(result.list, null, 2));
  }
  return parts.join("\n\n");
}
