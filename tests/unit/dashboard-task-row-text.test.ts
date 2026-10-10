// tests/unit/dashboard-task-row-text.test.ts — FR-DASH-05

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { overdueDaysForTask, taskRowDisplayText } from "../../backends/dashboard/task-row-text";
import { loadTasksRows } from "../../backends/dashboard/sources";
import { writeTasksFile } from "../../backends/tasks/task-file";
describe("taskRowDisplayText", () => {
  it("removes the due date token and normalizes spacing", () => {
    expect(
      taskRowDisplayText("Actualizar el portátil del trabajo. 2026-09-22", "2026-09-22"),
    ).toBe("Actualizar el portátil del trabajo.");
  });

  it("leaves text unchanged when there is no due date", () => {
    expect(taskRowDisplayText("Plain task", undefined)).toBe("Plain task");
  });
});

describe("overdueDaysForTask", () => {
  it("counts days when due is before today", () => {
    expect(overdueDaysForTask("2026-09-22", "2026-10-07")).toBe(15);
  });

  it("returns undefined for future or missing due", () => {
    expect(overdueDaysForTask("2026-12-01", "2026-10-07")).toBeUndefined();
    expect(overdueDaysForTask(undefined, "2026-10-07")).toBeUndefined();
  });
});

describe("loadTasksRows overdue_days", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("adds overdue_days only for past-due tasks", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-overdue-"));
    writeTasksFile(
      dir,
      [
        { id: 1, text: "Late", done: false, next: false, area: "work", dueDate: "2026-09-22" },
        { id: 2, text: "Future", done: false, next: false, area: "work", dueDate: "2026-12-01" },
      ],
      "2026-01-01",
    );
    const rows = loadTasksRows(dir, "2026-10-07");
    expect(rows[0]?.overdue_days).toBe(15);
    expect(rows[1]?.overdue_days).toBeUndefined();
  });
});
