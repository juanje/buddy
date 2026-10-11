// tests/unit/dashboard-indicative.test.ts — FR-DATA-07

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveDashboardContent } from "../../backends/dashboard/resolve";

function writeCsv(root: string, rel: string, content: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

describe("series indicative notice", () => {
  it("table widget is indicative when filtered rows include inferred origin", () => {
    const dir = mkdtempSync(join(tmpdir(), "dash-ind-"));
    writeCsv(
      dir,
      "user/data/migranas.csv",
      "fecha,hora,intensidad,origin,basis\n2026-10-11,09:00,6,inferred,chat\n2026-10-12,10:00,4,explicit,\n",
    );
    const md = `\`\`\`dashboard
- view: table
  source: series
  path: user/data/migranas.csv
  columns: [fecha, hora, intensidad]
\`\`\``;
    const resolved = resolveDashboardContent(dir, md, "2026-10-11");
    const seg = resolved.segments[0];
    expect(seg?.kind).toBe("widget");
    if (seg?.kind === "widget") expect(seg.indicative).toBe(true);
  });

  it("table widget is not indicative when filter excludes inferred rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "dash-ind-"));
    writeCsv(
      dir,
      "user/data/migranas.csv",
      "fecha,hora,intensidad,origin,basis\n2026-10-11,09:00,6,inferred,chat\n2026-10-12,10:00,4,explicit,\n",
    );
    const md = `\`\`\`dashboard
- view: table
  source: series
  path: user/data/migranas.csv
  where: origin = explicit
  columns: [fecha, hora, intensidad]
\`\`\``;
    const resolved = resolveDashboardContent(dir, md, "2026-10-11");
    const seg = resolved.segments[0];
    expect(seg?.kind).toBe("widget");
    if (seg?.kind === "widget") expect(seg.indicative).toBeFalsy();
  });

  it("counter widget is indicative when count includes inferred rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "dash-ind-"));
    writeCsv(
      dir,
      "user/data/migranas.csv",
      "fecha,hora,intensidad,origin,basis\n2026-10-11,09:00,6,inferred,chat\n2026-10-12,10:00,4,explicit,\n",
    );
    const md = `\`\`\`dashboard
- view: counter
  source: series
  path: user/data/migranas.csv
  count: true
\`\`\``;
    const resolved = resolveDashboardContent(dir, md, "2026-10-11");
    const seg = resolved.segments[0];
    expect(seg?.kind).toBe("widget");
    if (seg?.kind === "widget") {
      expect(seg.result.kind).toBe("value");
      expect(seg.indicative).toBe(true);
    }
  });
});
