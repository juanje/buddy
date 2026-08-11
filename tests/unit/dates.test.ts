// tests/unit/dates.test.ts — shared date helpers.

import { describe, expect, it } from "vitest";

import { formatLocalTime, toIsoDay, toLocalIsoStamp } from "../../shared/dates";

describe("formatLocalTime", () => {
  it("returns local HH:MM from an ISO UTC timestamp", () => {
    // 2026-07-26T14:30:00.000Z — local hours depend on host timezone
    const iso = "2026-07-26T14:30:00.000Z";
    const expected = (() => {
      const d = new Date(iso);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    })();
    expect(formatLocalTime(iso)).toBe(expected);
  });

  it("returns 00:00 for invalid timestamps", () => {
    expect(formatLocalTime("not-a-date")).toBe("00:00");
  });
});

describe("toIsoDay", () => {
  it("formats calendar date as YYYY-MM-DD", () => {
    expect(toIsoDay(new Date(2026, 6, 26))).toBe("2026-07-26");
  });
});

describe("toLocalIsoStamp", () => {
  it("returns YYYY-MM-DDTHH:MM using local time components", () => {
    const d = new Date(2026, 7, 11, 3, 9);
    expect(toLocalIsoStamp(d)).toBe("2026-08-11T03:09");
  });

  it("pads single-digit hours and minutes", () => {
    const d = new Date(2026, 0, 5, 2, 7);
    expect(toLocalIsoStamp(d)).toBe("2026-01-05T02:07");
  });

  it("does not append a UTC Z suffix", () => {
    expect(toLocalIsoStamp(new Date(2026, 7, 11, 3, 9))).not.toMatch(/Z$/);
  });
});
