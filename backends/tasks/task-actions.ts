// backends/tasks/task-actions.ts — tasks() action implementations (FR-TASK).

import type { TaskActionResult, TaskActionSuccess, TaskItem } from "../../shared/task-types";
import { readTaskConfig, writeTaskWipLimit } from "./task-config";
import {
  areaHasNext,
  buildListResult,
  clearNextInArea,
  countOpenInArea,
  findItemById,
  readTasksFile,
  writeTasksFile,
} from "./task-file";

const HELP_TEXT = `tasks() actions:
- help — list actions
- add(text, area?, due?, project?) — add open item
- complete(id) — mark done
- set_next(id) — mark as next action (>>) for its area
- list(area?, project?, include_done?, include_parked?, include_future?) — structured items with ids
- move(id, area) — change @area
- annotate(id, annotation) — add **metadata**
- remove(id) — delete item (requires confirmation)
- config(wipLimit?) — read or set WIP limit`;

export interface TaskActionParams {
  text?: string;
  area?: string;
  due?: string;
  project?: string;
  id?: number;
  annotation?: string;
  wipLimit?: number;
  include_done?: boolean;
  include_parked?: boolean;
  include_future?: boolean;
}

function err(error: string, suggestion?: string): TaskActionResult {
  return { ok: false, error, suggestion };
}

function ok(
  message: string,
  extra?: Partial<Omit<TaskActionSuccess, "ok" | "message">>,
): TaskActionSuccess {
  return { ok: true, message, ...extra };
}

function reindexItems(items: TaskItem[]): TaskItem[] {
  return items.map((item, index) => ({ ...item, id: index + 1 }));
}

function loadItems(rootDir: string): TaskItem[] {
  return readTasksFile(rootDir).items;
}

export function executeTaskAction(
  rootDir: string,
  action: string,
  params: TaskActionParams = {},
): TaskActionResult {
  switch (action) {
    case "help":
      return ok(HELP_TEXT);

    case "list": {
      const today = new Date().toISOString().slice(0, 10);
      let items = loadItems(rootDir);
      if (!params.include_done) {
        items = items.filter((item) => !item.done);
      }
      if (params.area) {
        const area = params.area.replace(/^@/, "");
        items = items.filter((item) => (item.area ?? "") === area);
      }
      if (params.project) {
        const project = params.project.replace(/^#/, "");
        items = items.filter((item) => (item.project ?? "") === project);
      }

      let parkedCount = 0;
      let futureCount = 0;
      let filtered = items;

      if (!params.include_parked) {
        parkedCount = filtered.filter((item) => item.area === "someday").length;
        filtered = filtered.filter((item) => item.area !== "someday");
      }
      if (!params.include_future) {
        futureCount = filtered.filter((item) => item.dueDate && item.dueDate > today).length;
        filtered = filtered.filter((item) => !(item.dueDate && item.dueDate > today));
      }

      const list = buildListResult(filtered, today);
      list.parkedCount = parkedCount;
      list.futureCount = futureCount;
      return ok("Task list:", { list });
    }

    case "config": {
      if (params.wipLimit !== undefined) {
        const limit = Number(params.wipLimit);
        if (!Number.isFinite(limit) || limit < 1) {
          return err("wipLimit must be a positive number.");
        }
        const config = writeTaskWipLimit(limit);
        return ok(`WIP limit set to ${config.wipLimit}.`);
      }
      const config = readTaskConfig();
      return ok(`WIP limit: ${config.wipLimit}`);
    }

    case "add": {
      const text = params.text?.trim();
      if (!text) return err("add requires params.text.", "Provide the task description.");

      const items = loadItems(rootDir);
      const openBefore = items.filter((item) => !item.done && item.area !== "someday").length;
      const { wipLimit } = readTaskConfig();
      let wipWarning: string | undefined;
      if (openBefore >= wipLimit) {
        wipWarning = `You now have ${openBefore + 1} open items (WIP limit: ${wipLimit}). Consider completing or parking something.`;
      }

      const area = params.area?.replace(/^@/, "");
      const project = params.project?.replace(/^#/, "");
      const openInAreaBefore = countOpenInArea(items, area);
      const newItem: TaskItem = {
        id: items.length + 1,
        text: params.due ? `${text} ${params.due}` : text,
        done: false,
        next: false,
        area,
        dueDate: params.due,
        project,
        created: new Date().toISOString().slice(0, 10),
      };

      const autoNext = openInAreaBefore === 0;
      if (autoNext) {
        clearNextInArea(items, area);
        newItem.next = true;
      }

      items.push(newItem);
      writeTasksFile(rootDir, reindexItems(items));

      let noNextForArea: string | undefined;
      if (!autoNext && !areaHasNext(items, area)) {
        noNextForArea = area || "general";
      }

      return ok("Task added.", { wipWarning, noNextForArea });
    }

    case "complete": {
      const id = params.id;
      if (id === undefined) return err("complete requires params.id.");
      const items = loadItems(rootDir);
      const item = findItemById(items, id);
      if (!item) return err(`No task with id ${id}.`, "Call list first for current ids.");
      const hadNext = item.next;
      const area = item.area;
      item.done = true;
      item.next = false;
      writeTasksFile(rootDir, reindexItems(items));
      return ok("Task completed.", hadNext ? { nextClearedForArea: area || "general" } : undefined);
    }

    case "set_next": {
      const id = params.id;
      if (id === undefined) return err("set_next requires params.id.");
      const items = loadItems(rootDir);
      const item = findItemById(items, id);
      if (!item) return err(`No task with id ${id}.`, "Call list first for current ids.");
      if (item.done) return err("Cannot set next on a completed task.");
      clearNextInArea(items, item.area);
      item.next = true;
      writeTasksFile(rootDir, reindexItems(items));
      return ok("Next action updated.");
    }

    case "move": {
      const id = params.id;
      const area = params.area?.replace(/^@/, "");
      if (id === undefined) return err("move requires params.id.");
      if (!area) return err("move requires params.area.");
      const items = loadItems(rootDir);
      const item = findItemById(items, id);
      if (!item) return err(`No task with id ${id}.`);
      item.area = area;
      writeTasksFile(rootDir, reindexItems(items));
      return ok(`Moved to @${area}.`);
    }

    case "annotate": {
      const id = params.id;
      const annotation = params.annotation?.trim();
      if (id === undefined) return err("annotate requires params.id.");
      if (!annotation) return err("annotate requires params.annotation.");
      const items = loadItems(rootDir);
      const item = findItemById(items, id);
      if (!item) return err(`No task with id ${id}.`);
      item.annotation = annotation;
      writeTasksFile(rootDir, reindexItems(items));
      return ok("Annotation added.");
    }

    case "remove": {
      const id = params.id;
      if (id === undefined) return err("remove requires params.id.");
      const items = loadItems(rootDir);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return err(`No task with id ${id}.`);
      items.splice(index, 1);
      writeTasksFile(rootDir, reindexItems(items));
      return ok("Task removed.");
    }

    default:
      return err(`Unknown action '${action}'.`, "Use action='help' to see available actions.");
  }
}
