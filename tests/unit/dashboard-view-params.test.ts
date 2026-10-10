// tests/unit/dashboard-view-params.test.ts — FR-DASH-10

import { describe, expect, it } from "vitest";

import { TASKS_SOURCE } from "../../shared/dashboard/source-fields";
import { validateViewParams } from "../../shared/dashboard/view-params";
import type { WidgetSpec } from "../../shared/dashboard/types";

function spec(raw: Record<string, unknown>): WidgetSpec {
  return { view: String(raw.view), source: String(raw.source), width: "full", raw };
}

describe("validateViewParams count and sum", () => {
  it("rejects count on a table and points at counter", () => {
    const err = validateViewParams(spec({ view: "table", source: "tasks", count: true }), TASKS_SOURCE);
    expect(err).toMatch(/view: counter/);
  });

  it("rejects sum on a list", () => {
    const err = validateViewParams(spec({ view: "list", source: "tasks", sum: "stale_days" }), TASKS_SOURCE);
    expect(err).toMatch(/view: counter/);
  });

  it("accepts grouped count on a counter", () => {
    const err = validateViewParams(
      spec({ view: "counter", source: "tasks", group: "area", count: true }),
      TASKS_SOURCE,
    );
    expect(err).toBeUndefined();
  });
});
