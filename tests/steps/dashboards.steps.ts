// tests/steps/dashboards.steps.ts — FR-DASH BDD steps.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { deferredPath } from "../../backends/brain-paths";
import { resolveDashboardContent } from "../../backends/dashboard/resolve";
import { writeTasksFile } from "../../backends/tasks/task-file";
import type { TaskItem } from "../../shared/task-types";
import type { ResolvedDashboard, ResolvedSegment } from "../../shared/dashboard/types";
import type { BuddyWorld } from "../support/world";

interface DashboardWorld extends BuddyWorld {
  buddyDir?: string;
  dashboardBody?: string;
  resolved?: ResolvedDashboard;
}

function root(this: DashboardWorld): string {
  assert.ok(this.buddyDir, "buddyDir required");
  return this.buddyDir;
}

Given("tasks.md with mixed states for dashboard resolution", function (this: DashboardWorld) {
  const items: TaskItem[] = [
    { id: 1, text: "Next one", done: false, next: true, area: "personal" },
    { id: 2, text: "Open one", done: false, next: false, area: "personal" },
    {
      id: 3,
      text: "Later",
      done: false,
      next: false,
      area: "personal",
      dueDate: "2026-12-01",
    },
    { id: 4, text: "Someday", done: false, next: false, area: "someday" },
  ];
  writeTasksFile(root.call(this), items, "2026-01-01");
});

Given("tasks.md with a stale open task", function (this: DashboardWorld) {
  const items: TaskItem[] = [
    {
      id: 1,
      text: "Old task",
      done: false,
      next: false,
      area: "personal",
      created: "2025-08-01",
    },
  ];
  writeTasksFile(root.call(this), items, "2025-08-01");
});

Given("tasks.md does not exist", function (this: DashboardWorld) {
  const path = join(root.call(this), "user", "tasks.md");
  if (existsSync(path)) unlinkSync(path);
});

Given("deferred.md with one due item", function (this: DashboardWorld) {
  const path = deferredPath(root.call(this));
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "---\ncreated: 2026-01-01\n---\n\n";
  const line = "- **reminder** (2026-10-05, user): Call back.";
  writeFileSync(path, `${existing.trimEnd()}\n${line}\n`, "utf8");
});

Given("a dashboard file with body:", function (this: DashboardWorld, body: string) {
  this.dashboardBody = [
    "---",
    "type: dashboard",
    "title: Test board",
    "summary: One line",
    "---",
    "",
    body.trim(),
  ].join("\n");
});

When("the dashboard is resolved for today {string}", function (this: DashboardWorld, today: string) {
  assert.ok(this.buddyDir && this.dashboardBody, "dashboard setup required");
  this.resolved = resolveDashboardContent(this.buddyDir, this.dashboardBody, today);
});

function segments(this: DashboardWorld): ResolvedSegment[] {
  assert.ok(this.resolved, "dashboard not resolved");
  return this.resolved.segments;
}

Then("the resolved dashboard has {int} segments", function (this: DashboardWorld, n: number) {
  assert.equal(segments.call(this).length, n);
});

Then("segment {int} is text {string}", function (this: DashboardWorld, index: number, text: string) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "text");
  if (seg.kind === "text") {
    assert.equal(seg.markdown.trim(), text);
  }
});

Then(
  "segment {int} is a text widget with width {word}",
  function (this: DashboardWorld, index: number, width: string) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.spec.view, "text");
      assert.equal(seg.spec.width ?? "full", width);
      assert.notEqual(seg.result.kind, "error");
    }
  },
);

Then("segment {int} is a text widget without error", function (this: DashboardWorld, index: number) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind === "widget") {
    assert.notEqual(seg.result.kind, "error");
  }
});

Then(
  "segment {int} widget result is an error mentioning {string}",
  function (this: DashboardWorld, index: number, fragment: string) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.result.kind, "error");
      if (seg.result.kind === "error") {
        assert.match(seg.result.message.toLowerCase(), new RegExp(fragment.toLowerCase()));
      }
    }
  },
);

Then("segment {int} widget result is an error", function (this: DashboardWorld, index: number) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind === "widget") {
    assert.equal(seg.result.kind, "error");
  }
});

function widgetRows(this: DashboardWorld, index: number): Record<string, unknown>[] {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind !== "widget") return [];
  assert.equal(seg.result.kind, "rows");
  if (seg.result.kind === "rows") return seg.result.rows;
  return [];
}

Then(
  "segment {int} widget rows include states {string}, {string}, {string}, {string}",
  function (
    this: DashboardWorld,
    index: number,
    a: string,
    b: string,
    c: string,
    d: string,
  ) {
    const states = new Set(widgetRows.call(this, index).map((r) => String(r.state)));
    for (const expected of [a, b, c, d]) {
      assert.ok(states.has(expected), `missing state ${expected}, got ${[...states].join(",")}`);
    }
  },
);

Then(
  "segment {int} widget rows include stale_days at least {int}",
  function (this: DashboardWorld, index: number, min: number) {
    const rows = widgetRows.call(this, index);
    assert.ok(rows.some((r) => typeof r.stale_days === "number" && r.stale_days >= min));
  },
);

Then(
  "segment {int} widget rows include deferred type {string}",
  function (this: DashboardWorld, index: number, type: string) {
    const rows = widgetRows.call(this, index);
    assert.ok(rows.some((r) => r.type === type));
  },
);

Then(
  "segment {int} is a table widget with {int} rows and no error",
  function (this: DashboardWorld, index: number, count: number) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.spec.view, "table");
      assert.notEqual(seg.result.kind, "error");
      assert.equal(seg.result.kind, "rows");
      if (seg.result.kind === "rows") {
        assert.equal(seg.result.rows.length, count);
      }
    }
  },
);
