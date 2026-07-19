// tests/unit/deferred.test.ts — FR-DEFERRED-01 deferred queue parser.

import { describe, expect, it } from "vitest";

import { dueDeferredItems, parseDeferredItems, toIsoDay } from "../../backends/deferred";

describe("parseDeferredItems", () => {
  it("parses well-formed entries", () => {
    const items = parseDeferredItems(
      [
        "# Deferred queue",
        "",
        "- **reminder** (2026-07-19, user): Llamar al dentista.",
        "- **decision** (2026-07-20, weekly): Decidir tema del blog.",
      ].join("\n"),
    );
    expect(items).toEqual([
      { type: "reminder", dueDate: "2026-07-19", source: "user", text: "Llamar al dentista." },
      { type: "decision", dueDate: "2026-07-20", source: "weekly", text: "Decidir tema del blog." },
    ]);
  });

  it("ignores prose, headers and malformed lines", () => {
    const items = parseDeferredItems(
      [
        "Queue semantics: write → present → act → remove.",
        "- not an entry",
        "- **reminder** (invalid-date, user): nope.",
        "(No pending entries.)",
      ].join("\n"),
    );
    expect(items).toEqual([]);
  });
});

describe("dueDeferredItems", () => {
  const items = parseDeferredItems(
    [
      "- **reminder** (2026-07-01, user): Overdue.",
      "- **reminder** (2026-07-19, user): Due today.",
      "- **reminder** (2026-08-15, user): Future.",
    ].join("\n"),
  );

  it("keeps items due today or earlier", () => {
    const due = dueDeferredItems(items, "2026-07-19");
    expect(due.map((i) => i.text)).toEqual(["Overdue.", "Due today."]);
  });
});

describe("toIsoDay", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(toIsoDay(new Date(2026, 6, 19, 23, 59))).toBe("2026-07-19");
    expect(toIsoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
