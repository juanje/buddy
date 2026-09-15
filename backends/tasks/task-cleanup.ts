// backends/tasks/task-cleanup.ts — Daily cleanup of completed tasks (FR-TASK-06, FR-TASKM-44).

import { readTasksFile, writeTasksFile } from "./task-file";

export interface TaskCleanupResult {
  removed: string[];
}

export function cleanupCompletedTasks(rootDir: string): TaskCleanupResult {
  const { items } = readTasksFile(rootDir);
  if (items.length === 0) return { removed: [] };

  const kept = items.filter((item) => !item.done);
  const removed = items.filter((item) => item.done).map((item) => item.text);

  if (removed.length === 0) return { removed: [] };

  writeTasksFile(
    rootDir,
    kept.map((item, index) => ({ ...item, id: index + 1 })),
  );
  return { removed };
}
