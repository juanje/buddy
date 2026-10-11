// tests/unit/dashboard-sources.test.ts — FR-DASH-05

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";

import { applyWidgetQuery } from "../../shared/dashboard/query";
import { sourceDefinition } from "../../shared/dashboard/source-fields";
import {
  loadDeferredRows,
  loadJournalRows,
  loadLogsRows,
  loadProjectsRows,
  loadSourceRows,
  loadTasksRows,
  loadWipRows,
} from "../../backends/dashboard/sources";
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

  it("loadProjectsRows returns empty when projects directory missing", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    expect(loadProjectsRows(dir)).toEqual([]);
  });

  it("loadJournalRows returns empty when journal directory missing", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    expect(loadJournalRows(dir)).toEqual([]);
  });

  it("loadJournalRows lists entry dates from journal files", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    const dayDir = join(dir, "user", "journal", "2026", "10");
    mkdirSync(dayDir, { recursive: true });
    writeFileSync(join(dayDir, "01.md"), "# Oct 1\n", "utf8");
    writeFileSync(join(dayDir, "05.md"), "# Oct 5\n", "utf8");
    const dates = loadJournalRows(dir).map((row) => row.date);
    expect(dates.sort()).toEqual(["2026-10-01", "2026-10-05"]);
  });

  it("loadLogsRows returns empty when logs index missing", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    expect(loadLogsRows(dir)).toEqual([]);
  });

  it("logs source range filter keeps rows inside the window", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      "- 2026-09-20: active — Old entry\n- 2026-10-05: active — Recent entry\n",
      "utf8",
    );
    const rows = loadLogsRows(dir);
    const def = sourceDefinition("logs")!;
    const queried = applyWidgetQuery(
      rows,
      {
        view: "table",
        source: "logs",
        raw: { range: "-14d..today", columns: ["date", "summary"] },
      },
      "logs",
      def,
      "2026-10-07",
    );
    expect(queried.ok).toBe(true);
    if (queried.ok && queried.result.kind === "rows") {
      expect(queried.result.rows).toHaveLength(1);
      expect(queried.result.rows[0]?.summary).toBe("Recent entry");
    }
  });

  it("loadWipRows exposes label state and reason for status cards", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    writeTasksFile(
      dir,
      [
        { id: 1, text: "a", done: false, next: false, area: "work", project: "p1" },
        { id: 2, text: "b", done: false, next: false, area: "work", project: "p2" },
        { id: 3, text: "c", done: false, next: false, area: "work", project: "p3" },
        { id: 4, text: "d", done: false, next: false, area: "work" },
        { id: 5, text: "e", done: false, next: false, area: "home", project: "p4" },
      ],
      "2026-01-01",
    );
    const rows = loadWipRows(dir, { wipLimit: 3 });
    const work = rows.find((r) => r.area === "work");
    const home = rows.find((r) => r.area === "home");
    expect(work).toMatchObject({ label: "@work", state: "bad", reason: "4 / 3" });
    expect(home).toMatchObject({ label: "@home", state: "ok", reason: "1 / 3" });
  });

  it("loadWipRows compares fronts with the limit and honours no-limit overrides", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    writeTasksFile(
      dir,
      [
        { id: 1, text: "a", done: false, next: false, area: "work", project: "p1" },
        { id: 2, text: "b", done: false, next: false, area: "work", project: "p2" },
        { id: 3, text: "c", done: false, next: false, area: "work" },
        { id: 4, text: "d", done: false, next: false, area: "blog", project: "p3" },
        { id: 5, text: "e", done: false, next: false, area: "blog", project: "p4" },
      ],
      "2026-01-01",
    );
    const rows = loadWipRows(dir, { wipLimit: 2, wipLimitOverrides: { blog: null } });
    const work = rows.find((r) => r.area === "work");
    const blog = rows.find((r) => r.area === "blog");
    expect(work).toMatchObject({ fronts: 3, limit: 2, over_by: 1, state: "bad", label: "@work" });
    expect(blog).toMatchObject({ fronts: 2, state: "ok" });
    expect(blog?.limit).toBeUndefined();
  });

  it("loadWipRows is empty without tasks", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    expect(loadWipRows(dir, { wipLimit: 3 })).toEqual([]);
  });

  it("loadProjectsRows reads summary and open task counts", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-src-"));
    const projectsDir = join(dir, "user", "projects");
    mkdirSync(projectsDir, { recursive: true });
    writeFileSync(
      join(projectsDir, "demo.md"),
      "---\nsummary: Demo project\ncreated: 2026-01-01\n---\n",
      "utf8",
    );
    writeTasksFile(
      dir,
      [
        { id: 1, text: "Step one", done: false, next: true, area: "work", project: "demo" },
        { id: 2, text: "Step two", done: false, next: false, area: "work", project: "demo" },
      ],
      "2026-01-01",
    );
    const rows = loadProjectsRows(dir);
    expect(rows[0]?.name).toBe("demo");
    expect(rows[0]?.summary).toBe("Demo project");
    expect(rows[0]?.open_tasks).toBe(2);
    expect(rows[0]?.next_action).toBe("Step one");
  });
});
