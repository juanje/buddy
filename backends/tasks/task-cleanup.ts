// backends/tasks/task-cleanup.ts — Daily cleanup of completed tasks (FR-TASK-06).

import { writeFileSync } from "node:fs";

import type { TaskItem } from "../../shared/task-types";
import { parseTaskFileContent, readTasksFile, tasksFilePath, writeTasksFile } from "./task-file";

const COMPLETION_KEYWORDS = [
  "complete",
  "completed",
  "done",
  "shipped",
  "finished",
  "resolved",
  "closed",
  "completado",
  "terminado",
];

export interface TaskCleanupResult {
  removed: string[];
  flagged: string[];
}

function itemMentionedInLog(text: string, logLower: string): boolean {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5);
  const matched = tokens.some((token) => logLower.includes(token));
  if (!matched) return false;
  return COMPLETION_KEYWORDS.some((word) => logLower.includes(word));
}

export function cleanupCompletedTasks(rootDir: string, logContent: string): TaskCleanupResult {
  const { items, content } = readTasksFile(rootDir);
  if (items.length === 0) return { removed: [], flagged: [] };

  const logLower = logContent.toLowerCase();
  const kept: TaskItem[] = [];
  const removed: string[] = [];
  const flagged: string[] = [];

  for (const item of items) {
    if (!item.done) {
      kept.push(item);
      continue;
    }
    if (itemMentionedInLog(item.text, logLower)) {
      removed.push(item.text);
      continue;
    }
    flagged.push(item.text);
    kept.push(item);
  }

  if (removed.length === 0 && flagged.length === 0) {
    return { removed, flagged };
  }

  let body = content;
  if (flagged.length > 0) {
    const lines = body.split("\n");
    const updated = lines.map((line) => {
      if (!line.includes("- [x]")) return line;
      const parsed = parseTaskFileContent(line);
      const text = parsed[0]?.text;
      if (text && flagged.includes(text) && !line.includes("verify:")) {
        return `${line} <!-- verify: not found in recent logs -->`;
      }
      return line;
    });
    body = updated.join("\n");
    writeFileSync(tasksFilePath(rootDir), body, "utf8");
    return { removed, flagged };
  }

  writeTasksFile(
    rootDir,
    kept.map((item, index) => ({ ...item, id: index + 1 })),
  );
  return { removed, flagged };
}
