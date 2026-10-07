// backends/dashboard/sources.ts — Load rows for built-in sources (FR-DASH-05).

import { existsSync, readFileSync } from "node:fs";

import { deferredPath } from "../brain-paths";
import { parseDeferredItems } from "../deferred";
import {
  buildListResult,
  readTasksFile,
  taskState,
} from "../tasks/task-file";
import { listKnownSourceNames } from "../../shared/dashboard/source-fields";

export type SourceLoadResult =
  | { ok: true; rows: Record<string, unknown>[] }
  | { ok: false; message: string };

export function loadSourceRows(
  rootDir: string,
  source: string,
  today: string,
): SourceLoadResult {
  if (source === "tasks") {
    return { ok: true, rows: loadTasksRows(rootDir, today) };
  }
  if (source === "deferred") {
    return { ok: true, rows: loadDeferredRows(rootDir) };
  }
  const known = listKnownSourceNames().join(", ");
  return { ok: false, message: `Unknown source '${source}'. Known sources: ${known}` };
}

export function loadTasksRows(rootDir: string, today: string): Record<string, unknown>[] {
  const { items } = readTasksFile(rootDir);
  const { items: enriched } = buildListResult(items, today);
  const rows: Record<string, unknown>[] = [];
  for (const item of enriched) {
    if (item.done) continue;
    const row: Record<string, unknown> = {
      text: item.text,
      area: item.area ?? "",
      project: item.project ?? "",
      due: item.dueDate ?? "",
      created: item.created ?? "",
      state: taskState(item, today),
    };
    if (item.staleDays !== undefined) {
      row.stale_days = item.staleDays;
    }
    rows.push(row);
  }
  return rows;
}

export function loadDeferredRows(rootDir: string): Record<string, unknown>[] {
  const path = deferredPath(rootDir);
  if (!existsSync(path)) return [];
  const items = parseDeferredItems(readFileSync(path, "utf8"));
  return items.map((item) => ({
    type: item.type,
    date: item.dueDate,
    source: item.source,
    text: item.text,
  }));
}
