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
import {
  buildDashboardViewModel,
  widgetKeysFromViewModel,
  type DashboardViewModel,
} from "../../src/lib/dashboard/view-model";
import type { AppLocale } from "../../src/lib/i18n";
import type { BuddyWorld } from "../support/world";

interface DashboardWorld extends BuddyWorld {
  buddyDir?: string;
  dashboardBody?: string;
  resolved?: ResolvedDashboard;
  viewModel?: DashboardViewModel;
}

function root(this: DashboardWorld): string {
  assert.ok(this.buddyDir, "buddyDir required");
  return this.buddyDir;
}

Given("tasks.md with a due date embedded in line text", function (this: DashboardWorld) {
  const items: TaskItem[] = [
    {
      id: 1,
      text: "Actualizar el portátil del trabajo. 2026-09-22",
      done: false,
      next: false,
      area: "work",
      dueDate: "2026-09-22",
    },
  ];
  writeTasksFile(root.call(this), items, "2026-01-01");
});

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

Given("tasks.md with one overdue and other open tasks", function (this: DashboardWorld) {
  const items: TaskItem[] = [
    {
      id: 1,
      text: "Overdue item",
      done: false,
      next: false,
      area: "personal",
      dueDate: "2026-09-22",
    },
    { id: 2, text: "Open one", done: false, next: false, area: "personal" },
    { id: 3, text: "Next one", done: false, next: true, area: "work" },
  ];
  writeTasksFile(root.call(this), items, "2026-01-01");
});

Given("tasks.md with an overdue open task", function (this: DashboardWorld) {
  const items: TaskItem[] = [
    {
      id: 1,
      text: "Overdue item",
      done: false,
      next: false,
      area: "personal",
      dueDate: "2026-09-22",
    },
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

Given("deferred.md with a far future item", function (this: DashboardWorld) {
  const path = deferredPath(root.call(this));
  const line = "- **info** (2027-01-01, user): Later.";
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "---\ncreated: 2026-01-01\n---\n\n";
  writeFileSync(path, `${existing.trimEnd()}\n${line}\n`, "utf8");
});

Given("tasks.md with many open tasks for sort limit", function (this: DashboardWorld) {
  const items: TaskItem[] = [
    { id: 1, text: "Alpha task", done: false, next: false, area: "personal" },
    { id: 2, text: "Zulu task", done: false, next: false, area: "personal" },
    { id: 3, text: "Middle task", done: false, next: false, area: "personal" },
  ];
  writeTasksFile(root.call(this), items, "2026-01-01");
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

When(
  "the dashboard view model is built for locale {string}",
  function (this: DashboardWorld, locale: string) {
    assert.ok(this.buddyDir && this.dashboardBody, "dashboard setup required");
    this.resolved = resolveDashboardContent(this.buddyDir, this.dashboardBody, "2026-10-07");
    this.viewModel = buildDashboardViewModel(this.resolved, locale as AppLocale, "Vacío");
  },
);

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

Then("segment {int} widget row count is {int}", function (this: DashboardWorld, index: number, count: number) {
  assert.equal(widgetRows.call(this, index).length, count);
});

Then(
  "segment {int} widget group value keys are {string}, {string}, {string}, {string}",
  function (this: DashboardWorld, index: number, a: string, b: string, c: string, d: string) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.result.kind, "group_values");
      if (seg.result.kind === "group_values") {
        const keys = seg.result.groups.map((g) => g.key ?? "null");
        assert.deepEqual(keys, [a, b, c, d]);
      }
    }
  },
);

Then(
  "segment {int} first widget row text is {string}",
  function (this: DashboardWorld, index: number, text: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.text), text);
  },
);

Then(
  "segment {int} first widget row due is {string}",
  function (this: DashboardWorld, index: number, due: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.due), due);
  },
);

Then(
  "segment {int} first widget row overdue_days is {int}",
  function (this: DashboardWorld, index: number, days: number) {
    const rows = widgetRows.call(this, index);
    assert.equal(rows[0]?.overdue_days, days);
  },
);

Then("the first widget has no display title", function (this: DashboardWorld) {
  assert.ok(this.viewModel, "view model required");
  const row = this.viewModel.rows.find((r) => r.kind === "widgetRow");
  assert.equal(row?.kind, "widgetRow");
  if (row?.kind === "widgetRow") {
    const widget = row.widgets[0];
    assert.notEqual(widget.kind, "error");
    assert.equal(widget.title, undefined);
  }
});

Then("the dashboard widget keys are distinct", function (this: DashboardWorld) {
  assert.ok(this.viewModel, "view model required");
  const keys = widgetKeysFromViewModel(this.viewModel);
  assert.equal(keys.length, new Set(keys).size);
});

Then(
  "segment {int} widget group value for {word} is {int}",
  function (this: DashboardWorld, index: number, area: string, value: number) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.result.kind, "group_values");
      if (seg.result.kind === "group_values") {
        const group = seg.result.groups.find((g) => g.key === area);
        assert.ok(group, `missing group ${area}`);
        assert.equal(group!.value, value);
      }
    }
  },
);

Then("the first kanban card has overdue days {int}", function (this: DashboardWorld, days: number) {
  assert.ok(this.viewModel, "view model required");
  const row = this.viewModel.rows.find((r) => r.kind === "widgetRow");
  assert.equal(row?.kind, "widgetRow");
  if (row?.kind === "widgetRow") {
    const kanban = row.widgets[0];
    assert.equal(kanban.kind, "kanban");
    if (kanban.kind === "kanban") {
      const card = kanban.columns.flatMap((c) => c.cards)[0];
      assert.equal(card?.overdueDays, days);
    }
  }
});

Then("the kanban workflow columns are ordered", function (this: DashboardWorld) {
  assert.ok(this.viewModel, "view model required");
  const row = this.viewModel.rows.find((r) => r.kind === "widgetRow");
  assert.equal(row?.kind, "widgetRow");
  if (row?.kind === "widgetRow") {
    const kanban = row.widgets[0];
    assert.equal(kanban.kind, "kanban");
    if (kanban.kind === "kanban") {
      assert.deepEqual(kanban.columns.map((col) => col.label), [
        "New",
        "In progress",
        "Blocked",
        "Done",
      ]);
      assert.equal(kanban.columns[0]?.cards.length, 0);
      assert.equal(kanban.columns[1]?.cards.length, 1);
    }
  }
});

Then(
  'the table header for {word} is {string}',
  function (this: DashboardWorld, field: string, label: string) {
    assert.ok(this.viewModel, "view model required");
    const row = this.viewModel.rows.find((r) => r.kind === "widgetRow");
    assert.equal(row?.kind, "widgetRow");
    if (row?.kind === "widgetRow") {
      const table = row.widgets[0];
      assert.equal(table.kind, "table");
      if (table.kind === "table") {
        const header = table.headers.find((h) => h.key === field);
        assert.equal(header?.label, label);
      }
    }
  },
);

Then("segment {int} widget rows have no overdue_days field", function (this: DashboardWorld, index: number) {
  const rows = widgetRows.call(this, index);
  for (const row of rows) {
    assert.equal(row.overdue_days, undefined);
  }
});

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

Then(
  "segment {int} widget value is {int} with delta {int}",
  function (this: DashboardWorld, index: number, value: number, delta: number) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.result.kind, "value");
      if (seg.result.kind === "value") {
        assert.equal(seg.result.value, value);
        assert.equal(seg.result.delta, delta);
      }
    }
  },
);

Then(
  "segment {int} text widget markdown contains {string}",
  function (this: DashboardWorld, index: number, fragment: string) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.result.kind, "text");
      if (seg.result.kind === "text") {
        assert.ok(seg.result.text.includes(fragment), seg.result.text);
      }
    }
  },
);

Then(
  "segment {int} widget has provenance age days {int}",
  function (this: DashboardWorld, index: number, days: number) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.ok(seg.provenance, "expected provenance");
      assert.equal(seg.provenance!.ageDays, days);
    }
  },
);

Then("segment {int} widget has no provenance", function (this: DashboardWorld, index: number) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind === "widget") {
    assert.equal(seg.provenance, undefined);
  }
});

Then("segment {int} widget rows count is {int}", function (this: DashboardWorld, index: number, count: number) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind === "widget") {
    assert.equal(seg.result.kind, "rows");
    if (seg.result.kind === "rows") {
      assert.equal(seg.result.rows.length, count);
    }
  }
});
