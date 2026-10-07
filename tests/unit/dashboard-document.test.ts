// tests/unit/dashboard-document.test.ts — FR-DASH-02

import { describe, expect, it } from "vitest";

import { isDashboardDocument, isDashboardPath } from "../../shared/dashboard/document";

describe("isDashboardPath", () => {
  it("accepts paths under user/dashboards", () => {
    expect(isDashboardPath("user/dashboards/a.md")).toBe(true);
    expect(isDashboardPath("user/dashboards/nested/x.md")).toBe(true);
  });

  it("rejects other locations", () => {
    expect(isDashboardPath("user/wiki/board.md")).toBe(false);
    expect(isDashboardPath("agent_brain/x.md")).toBe(false);
  });
});

describe("isDashboardDocument", () => {
  it("requires location and type dashboard", () => {
    expect(isDashboardDocument("user/dashboards/x.md", { type: "dashboard" })).toBe(true);
    expect(isDashboardDocument("user/wiki/x.md", { type: "dashboard" })).toBe(false);
    expect(isDashboardDocument("user/dashboards/x.md", {})).toBe(false);
  });
});
