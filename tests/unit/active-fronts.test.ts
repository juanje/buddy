// tests/unit/active-fronts.test.ts — FR-TASKM-39 parse AGENTS.md Right now.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formatActiveFrontsBlock, parseActiveFronts } from "../../backends/active-fronts";
import { bundledPromptsDir } from "../../backends/deploy-bundled-content";

const SAMPLE = `## Active context

### Right now
- Buddy C-post sprint @work
- Connector follow-up @work
- Review PRs @work
- Ley de dependencia @family

### Files
`;

describe("parseActiveFronts", () => {
  it("counts bullets with @area per area", () => {
    const report = parseActiveFronts(SAMPLE);
    expect(report.perArea).toEqual([
      { area: "work", count: 3 },
      { area: "family", count: 1 },
    ]);
    expect(report.total).toBe(4);
  });

  it("counts bullets without @area under (general)", () => {
    const report = parseActiveFronts(`## Active context

### Right now
- Something unlabeled
- Another unlabeled
- Tagged @work
`);
    expect(report.perArea).toEqual([
      { area: "(general)", count: 2 },
      { area: "work", count: 1 },
    ]);
  });

  it("returns zero counts when Right now is empty", () => {
    const report = parseActiveFronts(`## Active context

### Right now

### Files
`);
    expect(report.total).toBe(0);
    expect(report.perArea).toEqual([]);
  });
});

describe("formatActiveFrontsBlock", () => {
  it("formats per-area counts", () => {
    const block = formatActiveFrontsBlock(parseActiveFronts(SAMPLE));
    expect(block).toContain("Active fronts per area (from AGENTS.md):");
    expect(block).toContain("@work: 3");
    expect(block).toContain("@family: 1");
  });
});

describe("bundled consolidation prompt", () => {
  it("contains Active fronts per area and does not contain activeNextCount", () => {
    const prompt = readFileSync(join(bundledPromptsDir(), "consolidation.md"), "utf8");
    expect(prompt).toContain("Active fronts per area");
    expect(prompt).not.toContain("activeNextCount");
  });
});
