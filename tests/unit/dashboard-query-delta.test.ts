// tests/unit/dashboard-query-delta.test.ts — FR-DASH-10 counter delta

import { describe, expect, it } from "vitest";

import { applyWidgetQuery } from "../../shared/dashboard/query";
import { DEFERRED_SOURCE } from "../../shared/dashboard/source-fields";
import type { WidgetSpec } from "../../shared/dashboard/types";

describe("counter delta", () => {
  const today = "2026-10-07";
  const rows = [
    { type: "reminder", date: "2026-10-05", source: "user", text: "A" },
    { type: "info", date: "2026-09-20", source: "user", text: "Old" },
  ];

  function spec(raw: Record<string, unknown>): WidgetSpec {
    return { view: "counter", source: "deferred", width: "full", raw };
  }

  it("computes delta against the previous period of equal length", () => {
    const out = applyWidgetQuery(
      rows,
      spec({ count: true, range: "-7d..today", delta: true }),
      "deferred",
      DEFERRED_SOURCE,
      today,
    );
    expect(out.ok).toBe(true);
    if (out.ok && out.result.kind === "value") {
      expect(out.result.value).toBe(1);
      expect(out.result.delta).toBe(1);
    }
  });
});
