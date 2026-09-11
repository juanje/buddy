// backends/orientation.ts — First-open orientation data (FR-ORIENT-02).

import type { OrientationData } from "../shared/api";
import type { TaskItem } from "../shared/task-types";
import { getDueDeferred, removeDueDeferredItems, toDeferredItemViews } from "./deferred";
import { readLastOrientationDate, writeLastOrientationDate } from "./orientation-config";
import { readTasksFile } from "./tasks/task-file";

const NEXT_TASK_LIMIT = 3;

/** One next task per area, then fill with other open items up to the limit. */
export function selectNextTasks(
  items: TaskItem[],
  limit = NEXT_TASK_LIMIT,
  today?: string,
): TaskItem[] {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const open = items.filter(
    (item) =>
      !item.done &&
      item.area !== "someday" &&
      !(item.dueDate && item.dueDate > todayStr),
  );
  const chosen: TaskItem[] = [];
  const seenAreas = new Set<string>();

  for (const item of open.filter((task) => task.next)) {
    const area = item.area ?? "";
    if (seenAreas.has(area)) continue;
    seenAreas.add(area);
    chosen.push(item);
  }

  for (const item of open) {
    if (chosen.length >= limit) break;
    const area = item.area ?? "";
    if (seenAreas.has(area)) continue;
    seenAreas.add(area);
    chosen.push(item);
  }

  return chosen.slice(0, limit);
}

export function buildOrientationData(
  rootDir: string,
  today: string,
  configPath?: string,
): OrientationData | null {
  if (readLastOrientationDate(configPath) === today) {
    return null;
  }
  const deferred = toDeferredItemViews(
    getDueDeferred(rootDir, new Date(`${today}T12:00:00`)),
    today,
  );
  const { items } = readTasksFile(rootDir);
  const nextTasks = selectNextTasks(items, NEXT_TASK_LIMIT, today);
  return { deferred, nextTasks };
}

/** Persist last-shown date and acknowledge due deferred items (FR-ORIENT-02 dismiss). */
export function markOrientationDismissed(
  rootDir: string,
  today: string,
  configPath?: string,
): void {
  writeLastOrientationDate(today, configPath);
  removeDueDeferredItems(rootDir, new Date(`${today}T12:00:00`));
}
