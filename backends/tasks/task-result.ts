// backends/tasks/task-result.ts — TaskActionResult → tool text.

import type { TaskActionResult } from "../../shared/task-types";

export function taskResultToText(result: TaskActionResult): string {
  if (!result.ok) {
    return result.suggestion ? `${result.error}. ${result.suggestion}` : result.error;
  }
  const parts = [result.message];
  if (result.nextClearedForArea) {
    const area = result.nextClearedForArea || "general";
    const scopeLabel = result.nextClearedForProject
      ? `#${result.nextClearedForProject}`
      : `@${area} (loose tasks)`;
    if (result.remainingInArea !== undefined && result.remainingInArea > 0) {
      parts.push(
        `Next action cleared for ${scopeLabel}. ${result.remainingInArea} open tasks remain in ${scopeLabel} with none marked next — suggest one to the user so this area doesn't stall.`,
      );
    } else {
      parts.push(`Next action cleared for ${scopeLabel}. No open tasks remain in ${scopeLabel}.`);
    }
  }
  if (result.noNextForScope) {
    if (result.noNextForScope.startsWith("project:")) {
      const slug = result.noNextForScope.slice("project:".length);
      parts.push(`No next action set for #${slug} — consider set_next.`);
    } else {
      const area = result.noNextForScope.replace(/^area:/, "") || "general";
      parts.push(`No next action set for @${area} (loose tasks) — consider set_next.`);
    }
  } else if (result.noNextForArea) {
    parts.push(`No next action set for @${result.noNextForArea || "general"} — consider set_next.`);
  }
  if (result.list) {
    if (result.list.untaggedClusters && result.list.untaggedClusters.length > 0) {
      const summary = result.list.untaggedClusters
        .map(({ area, count }) => `@${area} (${count})`)
        .join(", ");
      parts.push(
        `Areas with 3+ untagged open tasks: ${summary}. Review whether any share a completable outcome — only propose a project if they do. Same area is not a shared outcome.`,
      );
    }
    parts.push(JSON.stringify(result.list, null, 2));
  }
  return parts.join("\n\n");
}
