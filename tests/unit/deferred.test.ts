// tests/unit/deferred.test.ts — FR-DEFERRED-01 deferred queue parser.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  dueDeferredItems,
  parseDeferredItems,
  removeDueDeferredItems,
  toDeferredItemViews,
  toIsoDay,
} from "../../backends/deferred";

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

  it("parses entries with optional time after date", () => {
    const items = parseDeferredItems(
      "- **reminder** (2026-07-23 01:56, user): Review the log status.\n",
    );
    expect(items).toEqual([
      { type: "reminder", dueDate: "2026-07-23", source: "user", text: "Review the log status." },
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

describe("toDeferredItemViews", () => {
  it("maps overdue flag from due date", () => {
    const items = parseDeferredItems(
      "- **reminder** (2026-07-01, user): Overdue.\n- **reminder** (2026-07-19, user): Due today.\n",
    );
    const views = toDeferredItemViews(items, "2026-07-19");
    expect(views[0]?.overdue).toBe(true);
    expect(views[1]?.overdue).toBe(false);
  });
});

describe("removeDueDeferredItems", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("removes due and overdue entries, keeps future and non-entry lines", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-deferred-rm-"));
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    writeFileSync(
      join(dir, "agent_brain", "deferred.md"),
      [
        "# Deferred queue",
        "",
        "- **reminder** (2026-07-01, user): Overdue.",
        "- **reminder** (2026-07-19, user): Due today.",
        "- **reminder** (2026-08-15, user): Future.",
        "",
      ].join("\n"),
      "utf8",
    );

    removeDueDeferredItems(dir, new Date(2026, 6, 19));

    const content = readFileSync(join(dir, "agent_brain", "deferred.md"), "utf8");
    expect(content).toContain("# Deferred queue");
    expect(content).not.toContain("Overdue.");
    expect(content).not.toContain("Due today.");
    expect(content).toContain("Future.");
  });

  it("no-ops when deferred.md is missing", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-deferred-rm-"));
    expect(() => removeDueDeferredItems(dir)).not.toThrow();
  });
});
