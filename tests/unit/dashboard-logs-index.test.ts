// tests/unit/dashboard-logs-index.test.ts — FR-DASH-18

import { describe, expect, it } from "vitest";

import {
  activeLogIndexDates,
  lastLogIndexDate,
  parseLogsIndex,
} from "../../backends/logs-index";

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

  it("accepts a line with status only and empty summary", () => {
    const rows = parseLogsIndex("- 2026-10-03: active\n");
    expect(rows).toEqual([{ date: "2026-10-03", status: "active", summary: "" }]);
  });

  it("accepts a hyphen separator between status and summary", () => {
    const rows = parseLogsIndex("- 2026-10-04: active - Hyphen summary\n");
    expect(rows).toEqual([
      { date: "2026-10-04", status: "active", summary: "Hyphen summary" },
    ]);
  });

  it("parses em dash summary that contains a hyphen", () => {
    const rows = parseLogsIndex("- 2026-10-05: active — A - B\n");
    expect(rows).toEqual([{ date: "2026-10-05", status: "active", summary: "A - B" }]);
  });

  it("lastLogIndexDate returns the last dated row", () => {
    const rows = parseLogsIndex("- 2026-10-01: active\n- 2026-10-02: maintenance\n");
    expect(lastLogIndexDate(rows)).toBe("2026-10-02");
  });

  it("activeLogIndexDates filters active status rows", () => {
    const rows = parseLogsIndex(
      "- 2026-07-20: active\n- 2026-07-21: active\n- 2026-07-22: maintenance\n",
    );
    expect(activeLogIndexDates(rows)).toEqual(["2026-07-20", "2026-07-21"]);
  });
});
