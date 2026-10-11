// tests/unit/consolidation-series.test.ts — FR-DATA-05

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeConsolidationSeriesEntry,
  formatConsolidationSeriesBlock,
} from "../../shared/data/consolidation-series";
import type { DataRegistryEntry } from "../../shared/data/registry";

function stressEntry(): DataRegistryEntry {
  return {
    name: "stress",
    path: "user/data/stress.csv",
    kind: "series",
    key: "date",
    columns: { date: "date", level: "number" },
    mode: "consolidation",
    inferred: false,
    sensitive: false,
  };
}

describe("consolidation series pending days", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("lists a day with log and no csv row", () => {
    dir = mkdtempSync(join(tmpdir(), "consol-series-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(join(dir, "logs/2026-10-10.md"), "notes\n");
    const result = computeConsolidationSeriesEntry(dir, stressEntry(), "2026-10-11");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pending).toContain("2026-10-10");
  });

  it("omits a day without log or journal", () => {
    dir = mkdtempSync(join(tmpdir(), "consol-series-"));
    const result = computeConsolidationSeriesEntry(dir, stressEntry(), "2026-10-11");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pending).not.toContain("2026-10-10");
  });

  it("truncates to 14 pending days with older omitted count", () => {
    dir = mkdtempSync(join(tmpdir(), "consol-series-"));
    mkdirSync(join(dir, "user/data"), { recursive: true });
    writeFileSync(join(dir, "user/data/stress.csv"), "date,level\n2026-09-01,1\n");
    mkdirSync(join(dir, "logs"), { recursive: true });
    for (let i = 1; i <= 16; i++) {
      const day = `2026-10-${String(i).padStart(2, "0")}`;
      writeFileSync(join(dir, `logs/${day}.md`), "x\n");
    }
    const result = computeConsolidationSeriesEntry(dir, stressEntry(), "2026-10-16");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pending.length).toBe(14);
      expect(result.omitted).toBeGreaterThan(0);
    }
  });

  it("format block reports non-date key entries", () => {
    dir = mkdtempSync(join(tmpdir(), "consol-series-"));
    const entry: DataRegistryEntry = {
      name: "bad",
      path: "user/data/bad.csv",
      kind: "series",
      key: "id",
      columns: { id: "string" },
      mode: "consolidation",
      inferred: false,
      sensitive: false,
    };
    const block = formatConsolidationSeriesBlock(dir, [entry], "2026-10-11");
    expect(block).toContain("exactly one date column");
  });
});
