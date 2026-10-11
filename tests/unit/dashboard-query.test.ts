// tests/unit/dashboard-query.test.ts — FR-DASH-04

import { describe, expect, it } from "vitest";

import { addMonths, applyWidgetQuery } from "../../shared/dashboard/query";
import { TASKS_SOURCE, type SourceDefinition } from "../../shared/dashboard/source-fields";
import type { WidgetSpec } from "../../shared/dashboard/types";

const REGIONS_SOURCE: SourceDefinition = {
  fields: {
    name: { kind: "string" },
    region: { kind: "string" },
    "sub-region": { kind: "string" },
  },
};

describe("addMonths", () => {
  it("clamps to last day of target month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("applyWidgetQuery", () => {
  const today = "2026-10-07";
  const rows = [
    { text: "A", area: "personal", state: "open" },
    { text: "B", area: "work", state: "next" },
  ];

  function spec(raw: Record<string, unknown>): WidgetSpec {
    return { view: "table", source: "tasks", width: "full", raw };
  }

  it("filters with where", () => {
    const out = applyWidgetQuery(rows, spec({ where: "area = @personal" }), "tasks", TASKS_SOURCE, today);
    expect(out.ok).toBe(true);
    if (out.ok && out.result.kind === "rows") {
      expect(out.result.rows).toHaveLength(1);
    }
  });

  it("rejects sum on non-numeric fields", () => {
    const out = applyWidgetQuery(rows, spec({ sum: "text" }), "tasks", TASKS_SOURCE, today);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/numeric/i);
  });

  it("filters numeric fields with >=", () => {
    const rowsNum = [
      { text: "Late", overdue_days: 15 },
      { text: "Fresh", overdue_days: 0 },
    ];
    const out = applyWidgetQuery(
      rowsNum,
      spec({ where: "overdue_days >= 1" }),
      "tasks",
      TASKS_SOURCE,
      today,
    );
    expect(out.ok).toBe(true);
    if (out.ok && out.result.kind === "rows") {
      expect(out.result.rows).toHaveLength(1);
      expect(out.result.rows[0]?.text).toBe("Late");
    }
  });

  it("rejects non-numeric filter values on number fields", () => {
    const out = applyWidgetQuery(
      rows,
      spec({ where: "stale_days > abc" }),
      "tasks",
      TASKS_SOURCE,
      today,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/not a number/i);
  });

  it("rejects where as a non-string value", () => {
    const out = applyWidgetQuery(
      rows,
      spec({ where: { region: "Europe" } }),
      "series",
      TASKS_SOURCE,
      today,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/where must be a string/i);
  });

  it("rejects double equals in where with a hint", () => {
    const regionRows = [{ name: "Spain", region: "Europe" }];
    const out = applyWidgetQuery(
      regionRows,
      spec({ where: "region == Europe" }),
      "series",
      REGIONS_SOURCE,
      today,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/Use '=' instead of '=='/);
  });

  it("filters hyphenated field names in where", () => {
    const regionRows = [
      { name: "Spain", region: "Europe", "sub-region": "Southern Europe" },
      { name: "Norway", region: "Europe", "sub-region": "Northern Europe" },
    ];
    const out = applyWidgetQuery(
      regionRows,
      spec({ where: "sub-region = Southern Europe" }),
      "series",
      REGIONS_SOURCE,
      today,
    );
    expect(out.ok).toBe(true);
    if (out.ok && out.result.kind === "rows") {
      expect(out.result.rows).toHaveLength(1);
      expect(out.result.rows[0]?.name).toBe("Spain");
    }
  });

  it("groups enum fields in declared order", () => {
    const many = [
      { text: "1", state: "open" },
      { text: "2", state: "next" },
      { text: "3", state: "scheduled" },
      { text: "4", state: "parked" },
    ];
    const out = applyWidgetQuery(
      many,
      spec({ group: "state", count: true }),
      "tasks",
      TASKS_SOURCE,
      today,
    );
    expect(out.ok).toBe(true);
    if (out.ok && out.result.kind === "group_values") {
      expect(out.result.groups.map((g) => g.key)).toEqual(["next", "open", "scheduled", "parked"]);
    }
  });
});
