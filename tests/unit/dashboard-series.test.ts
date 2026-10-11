import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadSeriesSource } from "../../backends/dashboard/series-load";
import {
  castSeriesRows,
  inferSeriesDefinition,
  validateSeriesHeader,
} from "../../shared/dashboard/series";

function writeCsv(root: string, rel: string, content: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

describe("series header validation", () => {
  it("rejects duplicate column names", () => {
    expect(validateSeriesHeader(["a", "a"])).toMatch(/Duplicate/);
  });

  it("rejects empty column names", () => {
    expect(validateSeriesHeader(["ok", ""])).toMatch(/empty/);
  });
});

describe("inferSeriesDefinition", () => {
  it("infers number, date, and string columns", () => {
    const def = inferSeriesDefinition(
      ["amount", "date", "note"],
      [
        { amount: "1.5", date: "2026-10-01", note: "x" },
        { amount: "2", date: "2026-10-02", note: "y" },
      ],
    );
    expect(def.fields.amount).toEqual({ kind: "number" });
    expect(def.fields.date).toEqual({ kind: "date" });
    expect(def.fields.note).toEqual({ kind: "string" });
    expect(def.dateField).toBe("date");
  });

  it("uses the first date column when date is not named date", () => {
    const def = inferSeriesDefinition(["when", "x"], [{ when: "2026-10-01", x: "a" }]);
    expect(def.dateField).toBe("when");
  });

  it("treats mixed numeric and text as string", () => {
    const def = inferSeriesDefinition(["mix"], [{ mix: "1" }, { mix: "two" }]);
    expect(def.fields.mix).toEqual({ kind: "string" });
  });
});

describe("castSeriesRows", () => {
  it("omits empty cells and casts numbers", () => {
    const def = inferSeriesDefinition(["n", "t"], [{ n: "3", t: "" }]);
    const rows = castSeriesRows([{ n: "3", t: "" }], def);
    expect(rows).toEqual([{ n: 3 }]);
  });
});

describe("loadSeriesSource", () => {
  it("parses quoted fields with commas and CRLF", () => {
    const dir = mkdtempSync(join(tmpdir(), "series-"));
    writeCsv(dir, "user/data/q.csv", 'a,b\r\n"hello, world",2\r\n');
    const out = loadSeriesSource(dir, "user/data/q.csv");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.rows[0]?.a).toBe("hello, world");
      expect(out.rows[0]?.b).toBe(2);
    }
  });

  it("reports malformed CSV with a line number", () => {
    const dir = mkdtempSync(join(tmpdir(), "series-"));
    writeCsv(dir, "user/data/bad.csv", 'a,b\n"open,2\n');
    const out = loadSeriesSource(dir, "user/data/bad.csv");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/line/i);
  });
});
