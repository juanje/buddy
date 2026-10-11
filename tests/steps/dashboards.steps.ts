// tests/steps/dashboards.steps.ts — FR-DASH BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { deferredPath, logsIndexPath } from "../../backends/brain-paths";
import { resolveDashboardContent } from "../../backends/dashboard/resolve";
import { writeTaskWipLimit } from "../../backends/tasks/task-config";
import { writeTasksFile } from "../../backends/tasks/task-file";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import type { TaskItem } from "../../shared/task-types";
import type { ResolvedDashboard, ResolvedSegment } from "../../shared/dashboard/types";
import {
  buildDashboardViewModel,
  TABLE_PAGE_SIZE,
  tablePageMeta,
  tablePageSlice,
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
  wipConfigDir?: string;
  tablePaginationShown?: number;
  tablePaginationLocale?: AppLocale;
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

Given("tasks.md with area and project tags for dashboard display", function (this: DashboardWorld) {
  const items: TaskItem[] = [
    {
      id: 1,
      text: "Tagged task",
      done: false,
      next: true,
      area: "personal",
      project: "alpha",
    },
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

Given(
  "a project file {string} with summary {string}",
  function (this: DashboardWorld, fileName: string, summary: string) {
    const dir = join(root.call(this), "user", "projects");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, fileName),
      `---\nsummary: ${summary}\ncreated: 2026-01-01\n---\n\n# Project\n`,
      "utf8",
    );
  },
);

Given(
  "tasks.md with open tasks for project {string}",
  function (this: DashboardWorld, project: string) {
    const items: TaskItem[] = [
      {
        id: 1,
        text: "Next alpha step",
        done: false,
        next: true,
        area: "work",
        project,
      },
      {
        id: 2,
        text: "Other alpha step",
        done: false,
        next: false,
        area: "work",
        project,
      },
    ];
    writeTasksFile(root.call(this), items, "2026-01-01");
  },
);

Given("a global WIP limit of {int}", function (this: DashboardWorld, limit: number) {
  this.wipConfigDir = setupGlobalConfigDir().configDir;
  writeTaskWipLimit(limit);
});

After(function (this: DashboardWorld) {
  if (this.wipConfigDir) {
    teardownGlobalConfigDir(this.wipConfigDir);
    this.wipConfigDir = undefined;
  }
});

Given(
  "tasks.md with {int} projects in area {string} and {int} project in area {string}",
  function (this: DashboardWorld, nA: number, areaA: string, nB: number, areaB: string) {
    const items: TaskItem[] = [];
    let id = 1;
    for (const [n, area] of [
      [nA, areaA],
      [nB, areaB],
    ] as const) {
      for (let i = 0; i < n; i += 1) {
        items.push({ id, text: `Step ${id}`, done: false, next: false, area, project: `${area}-p${i}` });
        id += 1;
      }
    }
    writeTasksFile(root.call(this), items, "2026-01-01");
  },
);

Then(
  "segment {int} first widget row area is {string}",
  function (this: DashboardWorld, index: number, area: string) {
    assert.equal(String(widgetRows.call(this, index)[0]?.area), area);
  },
);

Then(
  "segment {int} first widget row over_by is {int}",
  function (this: DashboardWorld, index: number, n: number) {
    assert.equal(widgetRows.call(this, index)[0]?.over_by, n);
  },
);

Then(
  "segment {int} first widget row state is {string}",
  function (this: DashboardWorld, index: number, state: string) {
    assert.equal(String(widgetRows.call(this, index)[0]?.state), state);
  },
);

Given("logs index with lines:", function (this: DashboardWorld, body: string) {
  const path = logsIndexPath(root.call(this));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${body.trim()}\n`, "utf8");
});

Given(
  "a journal entry at {string}",
  function (this: DashboardWorld, relPath: string) {
    const abs = join(root.call(this), "user", "journal", relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "# Journal\n", "utf8");
  },
);

Given("user journal directory does not exist", function (this: DashboardWorld) {
  const dir = join(root.call(this), "user", "journal");
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
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

Given(
  "a sections markdown file at {string} with content:",
  function (this: DashboardWorld, relPath: string, content: string) {
    const abs = join(root.call(this), relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content.trim() + "\n", "utf8");
  },
);

Given(
  "a csv file at {string} with content:",
  function (this: DashboardWorld, relPath: string, content: string) {
    const abs = join(root.call(this), relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content.trim() + "\n", "utf8");
  },
);

Given(
  "a csv file at {string} with {int} numbered rows and columns {string}",
  function (this: DashboardWorld, relPath: string, count: number, columnList: string) {
    const cols = columnList.split(",").map((c) => c.trim());
    const lines = [cols.join(",")];
    for (let i = 1; i <= count; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const cells = cols.map((col, j) =>
        j === 0 ? `2026-10-${day}` : col === "note" ? `row-${i}` : `${col}-${i}`,
      );
      lines.push(cells.join(","));
    }
    const abs = join(root.call(this), relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, lines.join("\n") + "\n", "utf8");
  },
);

function tableWidgetRows(vm: DashboardViewModel, segmentNum: number): Record<string, string>[] {
  let index = 0;
  for (const row of vm.rows) {
    if (row.kind !== "widgetRow") continue;
    for (const widget of row.widgets) {
      index += 1;
      if (index === segmentNum && widget.kind === "table") return widget.rows;
    }
  }
  throw new Error(`table widget ${segmentNum} not found`);
}

function visibleTableRows(world: DashboardWorld, segmentNum: number): Record<string, string>[] {
  assert.ok(world.viewModel, "viewModel required");
  const all = tableWidgetRows(world.viewModel, segmentNum);
  const shown = world.tablePaginationShown ?? TABLE_PAGE_SIZE;
  return tablePageSlice(all, shown);
}

When(
  "table pagination is at the default for segment {int}",
  function (this: DashboardWorld, _segmentNum: number) {
    this.tablePaginationShown = TABLE_PAGE_SIZE;
    this.tablePaginationLocale = "en";
  },
);

When("table pagination shows more for segment {int}", function (this: DashboardWorld, _segmentNum: number) {
  this.tablePaginationShown = (this.tablePaginationShown ?? TABLE_PAGE_SIZE) + TABLE_PAGE_SIZE;
});

Then(
  "segment {int} table visible row count is {int}",
  function (this: DashboardWorld, segmentNum: number, count: number) {
    assert.equal(visibleTableRows(this, segmentNum).length, count);
  },
);

Then(
  "segment {int} table pagination has more",
  function (this: DashboardWorld, segmentNum: number) {
    assert.ok(this.viewModel, "viewModel required");
    const all = tableWidgetRows(this.viewModel, segmentNum);
    const meta = tablePageMeta(this.tablePaginationShown ?? TABLE_PAGE_SIZE, all.length, "en");
    assert.ok(meta.hasMore);
  },
);

Then(
  "segment {int} table pagination has no more",
  function (this: DashboardWorld, segmentNum: number) {
    assert.ok(this.viewModel, "viewModel required");
    const all = tableWidgetRows(this.viewModel, segmentNum);
    const meta = tablePageMeta(this.tablePaginationShown ?? TABLE_PAGE_SIZE, all.length, "en");
    assert.ok(!meta.hasMore);
  },
);

function listWidgetItems(vm: DashboardViewModel, segmentNum: number) {
  let index = 0;
  for (const row of vm.rows) {
    if (row.kind !== "widgetRow") continue;
    for (const widget of row.widgets) {
      index += 1;
      if (index === segmentNum && widget.kind === "list") return widget.items;
    }
  }
  throw new Error(`list widget ${segmentNum} not found`);
}

Then(
  "segment {int} first list item fields are {string}",
  function (this: DashboardWorld, segmentNum: number, expected: string) {
    assert.ok(this.viewModel, "viewModel required");
    const items = listWidgetItems(this.viewModel, segmentNum);
    assert.equal(items[0]?.fields.join(" · "), expected);
  },
);

Then(
  "segment {int} table next page size is {int}",
  function (this: DashboardWorld, segmentNum: number, size: number) {
    assert.ok(this.viewModel, "viewModel required");
    const all = tableWidgetRows(this.viewModel, segmentNum);
    const meta = tablePageMeta(this.tablePaginationShown ?? TABLE_PAGE_SIZE, all.length, "en");
    assert.equal(meta.nextCount, size);
  },
);

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

Then("segment {int} widget result is not an error", function (this: DashboardWorld, index: number) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind === "widget") {
    assert.notEqual(seg.result.kind, "error");
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
  "segment {int} first widget row group is {string}",
  function (this: DashboardWorld, index: number, group: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.group), group);
  },
);

Then(
  "segment {int} first widget row owner is {string}",
  function (this: DashboardWorld, index: number, owner: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.owner), owner);
  },
);

Then(
  "segment {int} first widget row label is {string}",
  function (this: DashboardWorld, index: number, label: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.label), label);
  },
);

Then(
  "segment {int} first widget row done is {string}",
  function (this: DashboardWorld, index: number, done: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.done), done);
  },
);

Then(
  "segment {int} first widget row name is {string}",
  function (this: DashboardWorld, index: number, name: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.name), name);
  },
);

Then(
  "segment {int} first widget row code is {string}",
  function (this: DashboardWorld, index: number, code: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.code), code);
  },
);

Then(
  "segment {int} first widget row summary is {string}",
  function (this: DashboardWorld, index: number, summary: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.summary), summary);
  },
);

Then(
  "segment {int} first widget row open_tasks is {int}",
  function (this: DashboardWorld, index: number, count: number) {
    const rows = widgetRows.call(this, index);
    assert.equal(rows[0]?.open_tasks, count);
  },
);

Then(
  "segment {int} first widget row next_action is {string}",
  function (this: DashboardWorld, index: number, text: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.next_action), text);
  },
);

Then(
  "segment {int} first widget row status is {string}",
  function (this: DashboardWorld, index: number, status: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.status), status);
  },
);

Then(
  "segment {int} first widget row date is {string}",
  function (this: DashboardWorld, index: number, date: string) {
    const rows = widgetRows.call(this, index);
    assert.equal(String(rows[0]?.date), date);
  },
);

Then(
  "segment {int} widget value is {int}",
  function (this: DashboardWorld, index: number, value: number) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.result.kind, "value");
      if (seg.result.kind === "value") {
        assert.equal(seg.result.value, value);
      }
    }
  },
);

Then(
  "segment {int} first widget row overdue_days is {int}",
  function (this: DashboardWorld, index: number, days: number) {
    const rows = widgetRows.call(this, index);
    assert.equal(rows[0]?.overdue_days, days);
  },
);

Then(
  "the grouped counter label for {word} is {string}",
  function (this: DashboardWorld, _areaKey: string, expected: string) {
    assert.ok(this.viewModel, "view model required");
    const counter = this.viewModel.rows
      .flatMap((r) => (r.kind === "widgetRow" ? r.widgets : []))
      .find((w) => w.kind === "counter");
    assert.equal(counter?.kind, "counter");
    if (counter?.kind === "counter") {
      const group = counter.groups?.find((g) => g.label === expected);
      assert.ok(group, `expected group label ${expected}`);
    }
  },
);

Then(
  "a kanban card has chips {string} and {string}",
  function (this: DashboardWorld, chipA: string, chipB: string) {
    assert.ok(this.viewModel, "view model required");
    const kanban = this.viewModel.rows
      .flatMap((r) => (r.kind === "widgetRow" ? r.widgets : []))
      .find((w) => w.kind === "kanban");
    assert.equal(kanban?.kind, "kanban");
    if (kanban?.kind === "kanban") {
      const cards = kanban.columns.flatMap((c) => c.cards);
      const match = cards.some(
        (card) => card.chips.includes(chipA) && card.chips.includes(chipB),
      );
      assert.ok(match, `expected chips ${chipA} and ${chipB} on a card`);
    }
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

function ensureViewModel(this: DashboardWorld): DashboardViewModel {
  assert.ok(this.resolved, "resolved dashboard missing");
  if (!this.viewModel) {
    this.viewModel = buildDashboardViewModel(this.resolved, "en", "No data");
  }
  return this.viewModel;
}

function widgetVmAt(this: DashboardWorld, index: number) {
  const vm = ensureViewModel.call(this);
  let n = 0;
  for (const row of vm.rows) {
    if (row.kind !== "widgetRow") continue;
    for (const w of row.widgets) {
      n += 1;
      if (n === index) return w;
    }
  }
  throw new Error(`widget segment ${index} not found`);
}

When("the dashboard view model is built", function (this: DashboardWorld) {
  ensureViewModel.call(this);
});

Then(
  "segment {int} widget kind is {string}",
  function (this: DashboardWorld, index: number, kind: string) {
    assert.equal(widgetVmAt.call(this, index).kind, kind);
  },
);

Then(
  "segment {int} bar group {string} has total {int}",
  function (this: DashboardWorld, index: number, group: string, total: number) {
    const w = widgetVmAt.call(this, index);
    assert.equal(w.kind, "bar");
    if (w.kind !== "bar") return;
    const bar = w.chart.bars.find((b) => b.label === group);
    assert.ok(bar, `group ${group} missing`);
    assert.equal(bar!.total, total);
  },
);

Then(
  "segment {int} bar threshold is {int}",
  function (this: DashboardWorld, index: number, threshold: number) {
    const w = widgetVmAt.call(this, index);
    assert.equal(w.kind, "bar");
    if (w.kind === "bar") assert.equal(w.chart.threshold, threshold);
  },
);

Then(
  "segment {int} line chart x values are {string}",
  function (this: DashboardWorld, index: number, csv: string) {
    const w = widgetVmAt.call(this, index);
    assert.equal(w.kind, "line");
    if (w.kind !== "line") return;
    const xs = w.chart.points.map((p) => p.x).join(",");
    assert.equal(xs, csv);
  },
);

Then(
  "segment {int} progress data is value {int} max {int}",
  function (this: DashboardWorld, index: number, value: number, max: number) {
    const w = widgetVmAt.call(this, index);
    assert.equal(w.kind, "progress");
    if (w.kind !== "progress") return;
    assert.ok(w.data);
    assert.equal(w.data!.value, value);
    assert.equal(w.data!.max, max);
  },
);

Then(
  "segment {int} progress countdown days is {int}",
  function (this: DashboardWorld, index: number, days: number) {
    const w = widgetVmAt.call(this, index);
    assert.equal(w.kind, "progress");
    if (w.kind !== "progress") return;
    assert.ok(w.countdown);
    assert.equal(w.countdown!.daysRemaining, days);
  },
);

Then(
  "segment {int} calendar day {string} value is {int}",
  function (this: DashboardWorld, index: number, day: string, value: number) {
    const w = widgetVmAt.call(this, index);
    assert.equal(w.kind, "calendar");
    if (w.kind !== "calendar") return;
    const cell = w.chart.cells.find((c) => c.date === day);
    assert.ok(cell, `day ${day} missing`);
    assert.equal(cell!.value, value);
  },
);

Then(
  "segment {int} timeline labels are {string}",
  function (this: DashboardWorld, index: number, csv: string) {
    const w = widgetVmAt.call(this, index);
    assert.equal(w.kind, "timeline");
    if (w.kind !== "timeline") return;
    const labels = w.chart.events.map((e) => e.label).join(",");
    assert.equal(labels, csv);
  },
);

Then("segment {int} widget is indicative", function (this: DashboardWorld, index: number) {
  assert.ok(this.resolved, "resolved dashboard missing");
  const seg = this.resolved.segments[index - 1];
  assert.equal(seg?.kind, "widget");
  if (seg?.kind === "widget") assert.equal(seg.indicative, true);
});

Then("segment {int} widget is not indicative", function (this: DashboardWorld, index: number) {
  assert.ok(this.resolved, "resolved dashboard missing");
  const seg = this.resolved.segments[index - 1];
  assert.equal(seg?.kind, "widget");
  if (seg?.kind === "widget") assert.ok(!seg.indicative);
});

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
