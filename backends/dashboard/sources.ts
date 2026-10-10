// backends/dashboard/sources.ts — Load rows for built-in sources (FR-DASH-05).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isContained } from "../containment";
import { deferredPath, logsIndexPath } from "../brain-paths";
import { parseFrontmatter } from "../../shared/frontmatter";
import { parseDeferredItems } from "../deferred";
import {
  buildListResult,
  readTasksFile,
  taskState,
  tasksFilePath,
} from "../tasks/task-file";
import { listKnownSourceNames } from "../../shared/dashboard/source-fields";
import { parseLogsIndex } from "./logs-index";
import { overdueDaysForTask, taskRowDisplayText } from "./task-row-text";

export type SourceLoadResult =
  | { ok: true; rows: Record<string, unknown>[] }
  | { ok: false; message: string };

export function loadSourceRows(
  rootDir: string,
  source: string,
  today: string,
): SourceLoadResult {
  if (source === "tasks") {
    const path = tasksFilePath(rootDir);
    const blocked = assertSourcePath(rootDir, path, "tasks");
    if (blocked) return blocked;
    return { ok: true, rows: loadTasksRows(rootDir, today) };
  }
  if (source === "deferred") {
    const path = deferredPath(rootDir);
    const blocked = assertSourcePath(rootDir, path, "deferred");
    if (blocked) return blocked;
    return { ok: true, rows: loadDeferredRows(rootDir) };
  }
  if (source === "projects") {
    return { ok: true, rows: loadProjectsRows(rootDir) };
  }
  if (source === "logs") {
    return { ok: true, rows: loadLogsRows(rootDir) };
  }
  if (source === "journal") {
    return { ok: true, rows: loadJournalRows(rootDir) };
  }
  const known = listKnownSourceNames().join(", ");
  return { ok: false, message: `Unknown source '${source}'. Known sources: ${known}` };
}

function assertSourcePath(rootDir: string, absPath: string, label: string): SourceLoadResult | undefined {
  if (!isContained(absPath, rootDir)) {
    return {
      ok: false,
      message: `Cannot read ${label}: path escapes the buddy directory`,
    };
  }
  return undefined;
}

export function loadTasksRows(rootDir: string, today: string): Record<string, unknown>[] {
  const { items } = readTasksFile(rootDir);
  const { items: enriched } = buildListResult(items, today);
  const rows: Record<string, unknown>[] = [];
  for (const item of enriched) {
    if (item.done) continue;
    const row: Record<string, unknown> = {
      text: taskRowDisplayText(item.text, item.dueDate),
      area: item.area ?? "",
      project: item.project ?? "",
      due: item.dueDate ?? "",
      created: item.created ?? "",
      state: taskState(item, today),
    };
    if (item.staleDays !== undefined) {
      row.stale_days = item.staleDays;
    }
    const overdue = overdueDaysForTask(item.dueDate, today);
    if (overdue !== undefined) {
      row.overdue_days = overdue;
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

export function loadProjectsRows(rootDir: string): Record<string, unknown>[] {
  const projectsDir = join(rootDir, "user", "projects");
  if (!existsSync(projectsDir)) return [];
  const { items } = readTasksFile(rootDir);
  const openTasks = items.filter((item) => !item.done);

  let files: string[];
  try {
    files = readdirSync(projectsDir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }

  const rows: Record<string, unknown>[] = [];
  for (const file of files) {
    const name = file.replace(/\.md$/, "");
    const abs = join(projectsDir, file);
    if (!isContained(abs, rootDir)) continue;
    const content = readFileSync(abs, "utf8");
    const fm = parseFrontmatter(content);
    const projectTasks = openTasks.filter((t) => t.project === name);
    const nextMarked = projectTasks.find((t) => t.next);
    const next_action = nextMarked?.text ?? projectTasks[0]?.text ?? "";
    rows.push({
      name,
      summary: fm.summary ?? "",
      open_tasks: projectTasks.length,
      next_action,
    });
  }
  return rows;
}

export function loadLogsRows(rootDir: string): Record<string, unknown>[] {
  const path = logsIndexPath(rootDir);
  if (!isContained(path, rootDir)) return [];
  if (!existsSync(path)) return [];
  return parseLogsIndex(readFileSync(path, "utf8")).map((row) => ({ ...row }));
}

export function loadJournalRows(rootDir: string): Record<string, unknown>[] {
  const base = join(rootDir, "user", "journal");
  if (!existsSync(base)) return [];
  const rows: Record<string, unknown>[] = [];

  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = join(dir, ent.name);
      if (!isContained(abs, rootDir)) continue;
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      const isoFromName = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(ent.name);
      if (isoFromName) {
        rows.push({ date: isoFromName[1] });
        continue;
      }
      const dayFile = /^(\d{2})\.md$/.exec(ent.name);
      if (dayFile) {
        const monthDir = dir.split(/[/\\]/).pop();
        const yearDir = dir.split(/[/\\]/).slice(-2, -1)[0];
        if (monthDir && yearDir && /^\d{4}$/.test(yearDir) && /^\d{2}$/.test(monthDir)) {
          rows.push({ date: `${yearDir}-${monthDir}-${dayFile[1]}` });
        }
      }
    }
  };

  walk(base);
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return rows;
}
