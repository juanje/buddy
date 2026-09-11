// backends/tasks/task-file.ts — Parse and write user/tasks.md (FR-TASK).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

import { USER_DIR } from "../../shared/brain-paths";
import type { TaskItem, TaskListResult } from "../../shared/task-types";

const CHECKBOX_RE = /^- \[( |x)\] (>> )?(.*)$/;

function areaKey(area?: string): string {
  return area?.trim() || "";
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(`${start}T12:00:00`).getTime();
  const endMs = new Date(`${end}T12:00:00`).getTime();
  return Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24));
}

function parseFileCreated(content: string): string | undefined {
  const m = content.match(/^created:\s*(\S+)/m);
  return m?.[1];
}

function parseItemLine(line: string, id: number): TaskItem | null {
  const match = line.match(CHECKBOX_RE);
  if (!match) return null;

  const done = match[1] === "x";
  const next = Boolean(match[2]);
  let rest = match[3].trim();

  let created: string | undefined;
  const createdMatch = rest.match(/\s*<!-- c:(\d{4}-\d{2}-\d{2}) -->$/);
  if (createdMatch) {
    created = createdMatch[1];
    rest = rest.slice(0, createdMatch.index).trim();
  }

  let annotation: string | undefined;
  const annMatch = rest.match(/\*\*([^*]+)\*\*/);
  if (annMatch) {
    annotation = annMatch[1].trim();
    rest = rest.replace(/\*\*[^*]+\*\*/, "").trim();
  }

  let area: string | undefined;
  const areaMatch = rest.match(/\s@([\w-]+)\s*$/);
  if (areaMatch) {
    area = areaMatch[1];
    rest = rest.slice(0, areaMatch.index).trim();
  }

  let project: string | undefined;
  const projectMatch = rest.match(/\s#([\w-]+)\s*$/);
  if (projectMatch) {
    project = projectMatch[1];
    rest = rest.slice(0, projectMatch.index).trim();
  }

  let dueDate: string | undefined;
  const dateMatch = rest.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    dueDate = dateMatch[1];
  }

  const text = rest.trim();
  if (!text) return null;

  return {
    id,
    text,
    done,
    next: done ? false : next,
    area,
    dueDate,
    annotation,
    project,
    created,
  };
}

export function parseTaskFileContent(content: string): TaskItem[] {
  const items: TaskItem[] = [];
  let id = 0;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- [")) continue;
    id += 1;
    const item = parseItemLine(trimmed, id);
    if (item) items.push(item);
  }
  return items;
}

function formatItemLine(item: TaskItem): string {
  const checkbox = item.done ? "- [x]" : "- [ ]";
  const next = !item.done && item.next ? " >>" : "";
  const parts: string[] = [item.text];
  if (item.dueDate && !item.text.includes(item.dueDate)) {
    parts.push(item.dueDate);
  }
  if (item.annotation) {
    parts.push(`**${item.annotation}**`);
  }
  if (item.project) {
    parts.push(`#${item.project}`);
  }
  if (item.area) {
    parts.push(`@${item.area}`);
  }
  let line = `${checkbox}${next} ${parts.join(" ")}`.trimEnd();
  if (item.created) {
    line += ` <!-- c:${item.created} -->`;
  }
  return line;
}

export function serializeTaskFile(items: TaskItem[], created?: string): string {
  const date = created ?? new Date().toISOString().slice(0, 10);
  const lines = [
    "---",
    `created: ${date}`,
    "---",
    "",
    "# Tasks",
    "",
    ...items.map((item) => formatItemLine(item)),
  ];
  if (items.length > 0) lines.push("");
  return lines.join("\n");
}

export function tasksFilePath(rootDir: string): string {
  return join(rootDir, USER_DIR, "tasks.md");
}

export function readTasksFile(rootDir: string): { content: string; items: TaskItem[] } {
  const path = tasksFilePath(rootDir);
  if (!existsSync(path)) {
    return { content: "", items: [] };
  }
  const content = readFileSync(path, "utf8");
  const fileCreated = parseFileCreated(content);
  const items = parseTaskFileContent(content);
  if (fileCreated) {
    for (const item of items) {
      if (!item.created) item.created = fileCreated;
    }
  }
  return { content, items };
}

export function writeTasksFile(rootDir: string, items: TaskItem[], created?: string): void {
  const path = tasksFilePath(rootDir);
  mkdirSync(dirname(path), { recursive: true });
  let createdDate = created;
  if (!createdDate && existsSync(path)) {
    const existing = readFileSync(path, "utf8");
    const m = existing.match(/^created:\s*(\S+)/m);
    createdDate = m?.[1];
  }
  const body = serializeTaskFile(items, createdDate);
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, body, "utf8");
    renameSync(tmp, path);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // ignore
    }
    throw error;
  }
}

export function countActiveNext(items: TaskItem[], today?: string): number {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  return items.filter(
    (item) =>
      !item.done &&
      item.next &&
      item.area !== "someday" &&
      !(item.dueDate && item.dueDate > todayStr),
  ).length;
}

export function buildListResult(items: TaskItem[], today?: string): TaskListResult {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const areaMap = new Map<string, { open: number; hasNext: boolean }>();
  let openCount = 0;
  const enriched: TaskItem[] = items.map((item) => {
    const copy = { ...item };
    if (!copy.done && !copy.next && copy.created) {
      const age = daysBetween(copy.created, todayStr);
      if (age > 30) copy.staleDays = age;
    }
    return copy;
  });
  for (const item of enriched) {
    const key = areaKey(item.area);
    const entry = areaMap.get(key) ?? { open: 0, hasNext: false };
    if (!item.done) {
      entry.open += 1;
      openCount += 1;
      if (item.next) entry.hasNext = true;
    }
    areaMap.set(key, entry);
  }
  const areas = [...areaMap.entries()].map(([area, stats]) => ({
    area: area || "(general)",
    openCount: stats.open,
    hasNext: stats.hasNext,
  }));
  return { items: enriched, areas, openCount, parkedCount: 0, futureCount: 0, activeNextCount: 0 };
}

export function findItemById(items: TaskItem[], id: number): TaskItem | undefined {
  return items.find((item) => item.id === id);
}

export function clearNextInArea(items: TaskItem[], area?: string): void {
  const key = areaKey(area);
  for (const item of items) {
    if (!item.done && areaKey(item.area) === key) {
      item.next = false;
    }
  }
}

export function countOpenInArea(items: TaskItem[], area?: string): number {
  const key = areaKey(area);
  return items.filter((item) => !item.done && areaKey(item.area) === key).length;
}

export function areaHasNext(items: TaskItem[], area?: string): boolean {
  const key = areaKey(area);
  return items.some((item) => !item.done && item.next && areaKey(item.area) === key);
}
