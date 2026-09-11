// tests/unit/task-actions.test.ts — FR-TASK-02..04 task actions.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { executeTaskAction } from "../../backends/tasks/task-actions";
import { taskResultToText } from "../../backends/tasks/task-result";
import type { TaskActionSuccess } from "../../shared/task-types";
import { tasksFilePath, writeTasksFile } from "../../backends/tasks/task-file";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import { writeTaskWipLimit } from "../../backends/tasks/task-config";

describe("executeTaskAction", () => {
  let dir: string;
  let configDir: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-actions-"));
  });

  afterEach(() => {
    teardownGlobalConfigDir(configDir);
    rmSync(dir, { recursive: true, force: true });
  });

  it("add appends and auto-marks first item in area", () => {
    const result = executeTaskAction(dir, "add", { text: "Call dentist", area: "health" });
    assertSuccess(result);
    const content = readFileSync(tasksFilePath(dir), "utf8");
    expect(content).toContain(">> Call dentist @health");
  });

  it("set_next moves >> within area", () => {
    writeTasksFile(dir, [
      { id: 1, text: "A", done: false, next: true, area: "work" },
      { id: 2, text: "B", done: false, next: false, area: "work" },
    ]);
    executeTaskAction(dir, "set_next", { id: 2 });
    const content = readFileSync(tasksFilePath(dir), "utf8");
    expect(content).toMatch(/- \[ \] A @work/);
    expect(content).toMatch(/- \[ \] >> B @work/);
  });

  it("complete flags cleared next for area", () => {
    writeTasksFile(dir, [
      { id: 1, text: "Review PR", done: false, next: true, area: "work" },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "complete", { id: 1 }));
    expect(result.nextClearedForArea).toBe("work");
  });

  it("add does not warn when WIP exceeded but still adds", () => {
    ({ configDir } = setupGlobalConfigDir());
    writeTaskWipLimit(5);
    writeTasksFile(dir, Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      text: `T${i}`,
      done: false,
      next: i === 0,
    })));
    const result = assertSuccess(executeTaskAction(dir, "add", { text: "Overflow" }));
    expect(parseTaskFileCount(dir)).toBe(6);
    const text = taskResultToText(result);
    expect(text).not.toMatch(/WIP/i);
  });

  it("add stores project tag on new item", () => {
    const result = assertSuccess(
      executeTaskAction(dir, "add", { text: "Get DNI copy", area: "family", project: "ley-dep" }),
    );
    expect(result.message).toContain("added");
    const content = readFileSync(tasksFilePath(dir), "utf8");
    expect(content).toContain("#ley-dep @family");
  });

  it("list filters by project", () => {
    writeTasksFile(dir, [
      { id: 1, text: "Get DNI copy", done: false, next: true, project: "ley-dep", area: "family" },
      { id: 2, text: "Review PR", done: false, next: true, area: "work" },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", { project: "ley-dep" }));
    expect(result.list?.items).toHaveLength(1);
    expect(result.list?.items[0]?.project).toBe("ley-dep");
  });

  it("list without project returns all items including project-tagged ones", () => {
    writeTasksFile(dir, [
      { id: 1, text: "Get DNI copy", done: false, next: true, project: "ley-dep", area: "family" },
      { id: 2, text: "Review PR", done: false, next: true, area: "work" },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", {}));
    expect(result.list?.items).toHaveLength(2);
  });

  it("config reads and writes wipLimit", () => {
    ({ configDir } = setupGlobalConfigDir());
    writeTaskWipLimit(8);
    const read = assertSuccess(executeTaskAction(dir, "config"));
    expect(read.message).toContain("8");
    executeTaskAction(dir, "config", { wipLimit: 3 });
    const after = assertSuccess(executeTaskAction(dir, "config"));
    expect(after.message).toContain("3");
  });

  it("add sets created date equal to today", () => {
    const today = new Date().toISOString().slice(0, 10);
    executeTaskAction(dir, "add", { text: "Buy milk", area: "personal" });
    const result = assertSuccess(executeTaskAction(dir, "list", {}));
    expect(result.list?.items[0]?.created).toBe(today);
  });

  it("staleDays appears on stale open items in list", () => {
    const created = new Date();
    created.setDate(created.getDate() - 45);
    const createdStr = created.toISOString().slice(0, 10);
    writeTasksFile(dir, [
      { id: 1, text: "Old", done: false, next: false, area: "work", created: createdStr },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", {}));
    expect(result.list?.items[0]?.staleDays).toBe(45);
  });

  it("list excludes someday items by default", () => {
    writeTasksFile(dir, [
      { id: 1, text: "Active", done: false, next: true, area: "work" },
      { id: 2, text: "Parked", done: false, next: false, area: "someday" },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", {}));
    expect(result.list?.items).toHaveLength(1);
    expect(result.list?.items[0]?.area).toBe("work");
    expect(result.list?.parkedCount).toBe(1);
  });

  it("list includes someday items when include_parked is true", () => {
    writeTasksFile(dir, [
      { id: 1, text: "Active", done: false, next: true, area: "work" },
      { id: 2, text: "Parked", done: false, next: false, area: "someday" },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", { include_parked: true }));
    expect(result.list?.items.some((item) => item.area === "someday")).toBe(true);
    expect(result.list?.parkedCount).toBe(0);
  });

  it("list excludes future-dated items by default", () => {
    const future = new Date();
    future.setDate(future.getDate() + 14);
    const futureStr = future.toISOString().slice(0, 10);
    writeTasksFile(dir, [
      { id: 1, text: "Now", done: false, next: true, area: "work" },
      { id: 2, text: "Later", done: false, next: false, area: "personal", dueDate: futureStr },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", {}));
    expect(result.list?.items).toHaveLength(1);
    expect(result.list?.futureCount).toBe(1);
  });

  it("list includes future items when include_future is true", () => {
    const future = new Date();
    future.setDate(future.getDate() + 14);
    const futureStr = future.toISOString().slice(0, 10);
    writeTasksFile(dir, [
      { id: 1, text: "Now", done: false, next: true, area: "work" },
      { id: 2, text: "Later", done: false, next: false, area: "personal", dueDate: futureStr },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", { include_future: true }));
    expect(result.list?.items.some((item) => item.dueDate === futureStr)).toBe(true);
    expect(result.list?.futureCount).toBe(0);
  });

  it("list includes item due today (not future)", () => {
    const today = new Date().toISOString().slice(0, 10);
    writeTasksFile(dir, [
      { id: 1, text: "Due today", done: false, next: true, area: "work", dueDate: today },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "list", {}));
    expect(result.list?.items).toHaveLength(1);
    expect(result.list?.futureCount).toBe(0);
  });

  it("staleDays is not written to disk after list", () => {
    const created = new Date();
    created.setDate(created.getDate() - 45);
    const createdStr = created.toISOString().slice(0, 10);
    writeTasksFile(dir, [
      { id: 1, text: "Old", done: false, next: false, area: "work", created: createdStr },
    ]);
    executeTaskAction(dir, "list", {});
    const content = readFileSync(tasksFilePath(dir), "utf8");
    expect(content).not.toContain("staleDays");
  });

  it("staleDays computed from frontmatter-inferred created", () => {
    const created = new Date();
    created.setDate(created.getDate() - 45);
    const createdStr = created.toISOString().slice(0, 10);
    const fileContent = `---
created: ${createdStr}
---

# Tasks

- [ ] Legacy task @work
`;
    const path = tasksFilePath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, fileContent, "utf8");
    const result = assertSuccess(executeTaskAction(dir, "list", {}));
    expect(result.list?.items[0]?.staleDays).toBe(45);
  });

  it("add does not warn when someday items inflate open count", () => {
    ({ configDir } = setupGlobalConfigDir());
    writeTaskWipLimit(5);
    writeTasksFile(dir, [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: i + 1,
        text: `T${i}`,
        done: false,
        next: i === 0,
        area: "work",
      })),
      { id: 5, text: "S1", done: false, next: false, area: "someday" },
      { id: 6, text: "S2", done: false, next: false, area: "someday" },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "add", { text: "One more" }));
    expect(taskResultToText(result)).not.toMatch(/WIP/i);
  });

  it("add does not warn when non-someday count reaches limit", () => {
    ({ configDir } = setupGlobalConfigDir());
    writeTaskWipLimit(5);
    writeTasksFile(dir, [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        text: `T${i}`,
        done: false,
        next: i === 0,
        area: "work",
      })),
      { id: 6, text: "S1", done: false, next: false, area: "someday" },
    ]);
    const result = assertSuccess(executeTaskAction(dir, "add", { text: "Over limit" }));
    expect(taskResultToText(result)).not.toMatch(/WIP/i);
  });
});

function assertSuccess(result: ReturnType<typeof executeTaskAction>): TaskActionSuccess {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  return result;
}

function parseTaskFileCount(rootDir: string): number {
  const content = readFileSync(tasksFilePath(rootDir), "utf8");
  return content.split("\n").filter((line) => line.startsWith("- [")).length;
}
