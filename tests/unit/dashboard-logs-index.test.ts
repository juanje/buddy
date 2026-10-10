// tests/unit/dashboard-logs-index.test.ts — FR-DASH-18

import { describe, expect, it } from "vitest";

import { parseLogsIndex } from "../../backends/dashboard/logs-index";

describe("parseLogsIndex", () => {
  it("parses status and summary from index lines", () => {
    const rows = parseLogsIndex(
      "- 2026-10-01: active — First day\n- 2026-10-02: maintenance — Weekly\n",
    );
    expect(rows).toEqual([
      { date: "2026-10-01", status: "active", summary: "First day" },
      { date: "2026-10-02", status: "maintenance", summary: "Weekly" },
    ]);
  });
});
