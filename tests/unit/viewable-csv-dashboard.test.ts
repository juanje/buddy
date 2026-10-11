import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { resolveViewableDashboard } from "../../backends/dashboard/viewable-dashboard";

describe("resolveViewableDashboard csv", () => {
  let dir: string;
  let prevCap: string | undefined;

  afterEach(() => {
    if (prevCap === undefined) delete process.env.BUDDY_CSV_VIEW_ROW_CAP;
    else process.env.BUDDY_CSV_VIEW_ROW_CAP = prevCap;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function writeCsv(rel: string, lines: string[]) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, lines.join("\n") + "\n", "utf8");
  }

  it("builds a table dashboard from a csv path", () => {
    dir = mkdtempSync(join(tmpdir(), "csv-view-"));
    writeCsv("user/data/sample.csv", ["amount,label", "10,Alpha", "20,Beta"]);
    const model = resolveViewableDashboard(dir, "user/data/sample.csv", "2026-10-07");
    expect(model.title).toBe("sample.csv");
    const widget = model.segments.find((s) => s.kind === "widget");
    expect(widget?.kind).toBe("widget");
    if (widget?.kind === "widget") {
      expect(widget.spec.view).toBe("table");
      expect(widget.result.kind).toBe("rows");
      if (widget.result.kind === "rows") {
        expect(widget.result.rows).toHaveLength(2);
        expect(widget.result.rows[0]?.label).toBe("Alpha");
      }
    }
  });

  it("appends a cap notice when rows exceed the safety limit", () => {
    prevCap = process.env.BUDDY_CSV_VIEW_ROW_CAP;
    process.env.BUDDY_CSV_VIEW_ROW_CAP = "10";
    dir = mkdtempSync(join(tmpdir(), "csv-view-"));
    const lines = ["date,note"];
    for (let i = 1; i <= 15; i++) lines.push(`2026-10-${String(i).padStart(2, "0")},row-${i}`);
    writeCsv("user/data/big.csv", lines);
    const model = resolveViewableDashboard(dir, "user/data/big.csv", "2026-10-07");
    const text = model.segments.find((s) => s.kind === "text");
    expect(text?.kind).toBe("text");
    if (text?.kind === "text") {
      expect(text.markdown).toBe("Showing 10 of 15 rows");
    }
    const widget = model.segments.find((s) => s.kind === "widget");
    if (widget?.kind === "widget" && widget.result.kind === "rows") {
      expect(widget.result.rows).toHaveLength(10);
    }
  });
});
