// tests/unit/task-actions.test.ts — FR-TASK-02..04 task actions.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { executeTaskAction } from "../../backends/tasks/task-actions";
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

  it("add warns when WIP exceeded but still adds", () => {
    ({ configDir } = setupGlobalConfigDir());
    writeTaskWipLimit(5);
    writeTasksFile(dir, Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      text: `T${i}`,
      done: false,
      next: i === 0,
    })));
    const result = assertSuccess(executeTaskAction(dir, "add", { text: "Overflow" }));
    expect(result.wipWarning).toMatch(/WIP/i);
    expect(parseTaskFileCount(dir)).toBe(6);
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
