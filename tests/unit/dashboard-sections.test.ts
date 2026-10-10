// tests/unit/dashboard-sections.test.ts — FR-DASH-06

import { describe, expect, it } from "vitest";

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadSectionsSource } from "../../backends/dashboard/sections-load";
import { parseSections, sectionsFit } from "../../shared/dashboard/sections";

describe("sectionsFit", () => {
  it("accepts a heading with a list item", () => {
    const md = "## A\n- one\n";
    expect(sectionsFit(md)).toBe(true);
  });

  it("rejects plain prose without structure", () => {
    expect(sectionsFit("# Title\n\nParagraph only.\n")).toBe(false);
  });

  it("rejects a heading without items", () => {
    expect(sectionsFit("## Empty\n\nNo lists.\n")).toBe(false);
  });
});

describe("parseSections", () => {
  it("groups rows by heading", () => {
    const rows = parseSections(`## Doing\n- Alpha\n## Next\n- Beta\n`);
    expect(rows).toEqual([
      { text: "Alpha", group: "Doing" },
      { text: "Beta", group: "Next" },
    ]);
  });

  it("parses checkbox done state", () => {
    const rows = parseSections(`## Tasks\n- [x] Done one\n- [ ] Open one\n`);
    expect(rows[0]?.done).toBe(true);
    expect(rows[1]?.done).toBe(false);
  });

  it("maps key value sub-bullets to fields", () => {
    const md = `## Items\n- Ship it\n  - owner: Ana\n  - Extra note\n`;
    const rows = parseSections(md);
    expect(rows[0]?.owner).toBe("Ana");
    expect(rows[0]?.detail).toBe("Extra note");
  });
});

describe("loadSectionsSource", () => {
  it("rejects paths outside the buddy directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "dash-sec-"));
    try {
      const out = loadSectionsSource(dir, "../../../etc/passwd");
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.message.toLowerCase()).toMatch(/cannot be opened/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
