// tests/unit/dashboard-schema.test.ts — FR-DASH-01

import { describe, expect, it } from "vitest";

import { validateWidgetSpec } from "../../shared/dashboard/schema";

describe("validateWidgetSpec", () => {
  it("accepts a text widget", () => {
    const out = validateWidgetSpec({ view: "text", text: "Hello" });
    expect(out.error).toBeUndefined();
    expect(out.spec?.view).toBe("text");
    expect(out.spec?.width).toBe("full");
  });

  it("rejects unknown view", () => {
    const out = validateWidgetSpec({ view: "piechart", source: "tasks" });
    expect(out.error).toMatch(/piechart/i);
  });

  it("rejects unknown keys and names them", () => {
    const out = validateWidgetSpec({ view: "text", text: "x", not_a_key: 1 });
    expect(out.error).toMatch(/not_a_key/i);
  });
});
