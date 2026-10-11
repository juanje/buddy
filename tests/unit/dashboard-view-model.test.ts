// tests/unit/dashboard-view-model.test.ts — FR-DASH-10 view-model

import { describe, expect, it } from "vitest";

import type { ResolvedDashboard } from "../../shared/dashboard/types";
import { setLocale } from "../../src/lib/i18n";
import {
  buildDashboardViewModel,
  layoutWidgetRows,
  statusTone,
  TABLE_PAGE_SIZE,
  tablePageMeta,
  tablePageSlice,
  taskStateLabel,
  type DashboardWidgetVm,
} from "../../src/lib/dashboard/view-model";

describe("taskStateLabel", () => {
  it("localizes task states in Spanish", () => {
    setLocale("es");
    expect(taskStateLabel("next", "es")).toBe("Siguiente");
    expect(taskStateLabel("open", "es")).toBe("Abierta");
  });
});

describe("layoutWidgetRows", () => {
  it("places two half widgets on one row", () => {
    const half = (title: string): DashboardWidgetVm => ({
      kind: "counter",
      key: title,
      title,
      width: "half",
      value: 1,
      empty: false,
    });
    const rows = layoutWidgetRows([half("A"), half("B")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
  });
});

describe("buildDashboardViewModel kanban", () => {
  it("orders task state columns and Spanish labels", () => {
    setLocale("es");
    const model: ResolvedDashboard = {
      today: "2026-10-07",
      segments: [
        {
          kind: "widget",
          spec: {
            view: "kanban",
            source: "tasks",
            width: "full",
            raw: { view: "kanban", source: "tasks", group: "state" },
          },
          result: {
            kind: "groups",
            groups: [
              { key: "open", rows: [{ text: "One" }] },
              { key: "next", rows: [{ text: "Two" }] },
              { key: "scheduled", rows: [] },
              { key: "parked", rows: [] },
            ],
          },
        },
      ],
    };
    const vm = buildDashboardViewModel(model, "es", "Vacío");
    const row = vm.rows.find((r) => r.kind === "widgetRow");
    expect(row?.kind).toBe("widgetRow");
    if (row?.kind === "widgetRow") {
      const kanban = row.widgets[0];
      expect(kanban.kind).toBe("kanban");
      if (kanban.kind === "kanban") {
        expect(kanban.columns.map((c) => c.label)).toEqual([
          "Siguiente",
          "Abierta",
          "Programada",
          "Aparcada",
        ]);
      }
    }
  });
});

describe("buildDashboardViewModel task field display", () => {
  it("prefixes counter group labels for tasks area", () => {
    const model: ResolvedDashboard = {
      today: "2026-10-07",
      segments: [
        {
          kind: "widget",
          spec: {
            view: "counter",
            source: "tasks",
            width: "full",
            raw: { view: "counter", source: "tasks", count: true, group: "area" },
          },
          result: {
            kind: "group_values",
            groups: [
              { key: "personal", value: 2 },
              { key: "work", value: 1 },
            ],
          },
        },
      ],
    };
    const vm = buildDashboardViewModel(model, "es", "Vacío");
    const row = vm.rows.find((r) => r.kind === "widgetRow");
    if (row?.kind === "widgetRow") {
      const counter = row.widgets[0];
      expect(counter.kind).toBe("counter");
      if (counter.kind === "counter") {
        expect(counter.groups?.map((g) => g.label)).toEqual(["@personal", "@work"]);
      }
    }
  });
});

describe("buildDashboardViewModel widget titles", () => {
  it("omits heading title when the widget spec has no title", () => {
    const model: ResolvedDashboard = {
      today: "2026-10-07",
      segments: [
        {
          kind: "widget",
          spec: {
            view: "counter",
            source: "tasks",
            width: "full",
            raw: { view: "counter", source: "tasks", count: true },
          },
          result: { kind: "value", value: 3 },
        },
      ],
    };
    const vm = buildDashboardViewModel(model, "es", "Vacío");
    const row = vm.rows.find((r) => r.kind === "widgetRow");
    expect(row?.kind).toBe("widgetRow");
    if (row?.kind === "widgetRow") {
      expect(row.widgets[0]?.kind).toBe("counter");
      if (row.widgets[0]?.kind === "counter") {
        expect(row.widgets[0].title).toBeUndefined();
      }
    }
  });

  it("uses a localized view label on error widgets without title", () => {
    const model: ResolvedDashboard = {
      today: "2026-10-07",
      segments: [
        {
          kind: "widget",
          spec: {
            view: "kanban",
            source: "tasks",
            width: "full",
            raw: { view: "kanban", source: "tasks" },
          },
          result: { kind: "error", message: "group required" },
        },
      ],
    };
    const vm = buildDashboardViewModel(model, "es", "Vacío");
    const row = vm.rows.find((r) => r.kind === "widgetRow");
    if (row?.kind === "widgetRow") {
      const widget = row.widgets[0];
      expect(widget.kind).toBe("error");
      if (widget.kind === "error") {
        expect(widget.title).toBe("Kanban");
      }
    }
  });
});

describe("statusTone", () => {
  it("maps known states", () => {
    expect(statusTone("ok")).toBe("ok");
    expect(statusTone("warn")).toBe("warn");
    expect(statusTone("bad")).toBe("bad");
    expect(statusTone("weird")).toBe("unknown");
  });
});

describe("table pagination", () => {
  it("shows the first page and more footer", () => {
    const rows = Array.from({ length: 120 }, (_, i) => i);
    expect(tablePageSlice(rows, TABLE_PAGE_SIZE)).toHaveLength(50);
    const meta = tablePageMeta(TABLE_PAGE_SIZE, 120, "en");
    expect(meta.hasMore).toBe(true);
    expect(meta.footerText).toBe("50 of 120 rows");
    expect(meta.nextCount).toBe(50);
  });

  it("clears hasMore when all rows are shown", () => {
    const meta = tablePageMeta(120, 120, "en");
    expect(meta.hasMore).toBe(false);
    expect(meta.nextCount).toBe(0);
  });

  it("next page size is the remaining rows when fewer than 50", () => {
    expect(tablePageMeta(TABLE_PAGE_SIZE, 51, "en").nextCount).toBe(1);
  });
});

describe("list view model", () => {
  it("does not repeat the primary field in list meta", () => {
    const model: ResolvedDashboard = {
      title: "T",
      today: "2026-10-07",
      segments: [
        {
          kind: "widget",
          spec: {
            view: "list",
            source: "series",
            raw: {
              view: "list",
              source: "series",
              path: "user/data/x.csv",
              fields: ["name", "region"],
            },
          },
          result: {
            kind: "rows",
            rows: [{ name: "Fiji", region: "Oceania" }],
          },
        },
      ],
    };
    const vm = buildDashboardViewModel(model, "en", "T");
    const list = vm.rows
      .flatMap((r) => (r.kind === "widgetRow" ? r.widgets : []))
      .find((w) => w.kind === "list");
    expect(list?.kind).toBe("list");
    if (list?.kind === "list") {
      expect(list.items[0]?.primary).toBe("Fiji");
      expect(list.items[0]?.fields).toEqual(["Oceania"]);
    }
  });
});
