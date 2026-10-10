// tests/unit/dashboard-field-labels.test.ts — FR-DASH-10

import { describe, expect, it } from "vitest";

import { humanizeFieldLabel, overdueLabel } from "../../src/lib/dashboard/field-labels";

describe("humanizeFieldLabel", () => {
  it("localizes tasks source fields in Spanish", () => {
    expect(humanizeFieldLabel("text", "tasks", "es")).toBe("Tarea");
    expect(humanizeFieldLabel("due", "tasks", "es")).toBe("Vence");
  });

  it("capitalizes inline field names", () => {
    expect(humanizeFieldLabel("paso", "inline", "es")).toBe("Paso");
  });
});

describe("overdueLabel", () => {
  it("uses singular phrasing for one day", () => {
    expect(overdueLabel(1, "en")).toBe("overdue by 1 day");
    expect(overdueLabel(1, "es")).toBe("vencida hace 1 día");
  });
});
