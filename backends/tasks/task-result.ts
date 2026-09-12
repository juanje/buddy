// backends/tasks/task-result.ts — TaskActionResult → tool text.

import type { TaskActionResult } from "../../shared/task-types";

export function taskResultToText(result: TaskActionResult): string {
  if (!result.ok) {
    return result.suggestion ? `${result.error}. ${result.suggestion}` : result.error;
  }
  const parts = [result.message];
  if (result.nextClearedForArea) {
    const area = result.nextClearedForArea || "general";
    if (result.remainingInArea !== undefined && result.remainingInArea > 0) {
      parts.push(
        `Next action cleared for @${area}. ${result.remainingInArea} open tasks remain with none marked next — suggest one to the user so this area doesn't stall.`,
      );
    } else {
      parts.push(`Next action cleared for @${area}. No open tasks remain in this area.`);
    }
  }
  if (result.noNextForArea) {
    parts.push(`No next action set for @${result.noNextForArea || "general"} — consider set_next.`);
  }
  if (result.list) {
    parts.push(JSON.stringify(result.list, null, 2));
  }
  return parts.join("\n\n");
}
