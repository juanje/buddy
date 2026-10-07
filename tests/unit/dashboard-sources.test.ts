// tests/unit/dashboard-sources.test.ts — FR-DASH-05

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";

import { loadDeferredRows, loadSourceRows, loadTasksRows } from "../../backends/dashboard/sources";
import { writeTasksFile } from "../../backends/tasks/task-file";
import { taskState } from "../../backends/tasks/task-file";

describe("taskState", () => {
  it("derives parked scheduled next and open", () => {
    expect(taskState({ id: 1, text: "a", done: false, next: false, area: "someday" }, "2026-10-07")).toBe(
      "parked",
    );
    expect(
      taskState(
        { id: 2, text: "b", done: false, next: true, area: "work", dueDate: "2026-12-01" },
        "2026-10-07",
      ),
    ).toBe("scheduled");
    expect(taskState({ id: 3, text: "c", done: false, next: true, area: "work" }, "2026-10-07")).toBe(
      "next",
    );
    expect(taskState({ id: 4, text: "d", done: false, next: false, area: "work" }, "2026-10-07")).toBe(
      "open",
    );
  });
});

describe("loadSourceRows", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty tasks rows when tasks.md is missing", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    const out = loadSourceRows(dir, "tasks", "2026-10-07");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.rows).toHaveLength(0);
  });

  it("rejects unknown sources with a helpful message", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    const out = loadSourceRows(dir, "jira", "2026-10-07");
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.message).toMatch(/jira/i);
      expect(out.message).toMatch(/tasks/i);
    }
  });

  it("loads stale_days on aged tasks", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    writeTasksFile(
      dir,
      [{ id: 1, text: "Old", done: false, next: false, area: "personal", created: "2025-01-01" }],
      "2025-01-01",
    );
    const rows = loadTasksRows(dir, "2026-10-07");
    expect(rows[0]?.stale_days).toBeGreaterThanOrEqual(31);
  });

  it("loadDeferredRows returns empty when file missing", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    expect(loadDeferredRows(dir)).toEqual([]);
  });
});
