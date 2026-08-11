// tests/unit/wiki-check.test.ts — FR-WIKI-05 wiki health check and repair.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WIKI_DIR } from "../../shared/brain-paths";
import { wikiCheck, wikiRepairLinks, WIKI_THIN_PAGE_MIN_LINES } from "../../backends/wiki-check";
import { formatWikiPage } from "../../backends/wiki-format";
import { regenerateWikiIndex } from "../../backends/wiki-index";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "wiki-check-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function wikiJoin(...parts: string[]): string {
  return join(root, WIKI_DIR, ...parts);
}

function writePage(relPath: string, data: Parameters<typeof formatWikiPage>[0]): void {
  mkdirSync(join(wikiJoin(relPath), ".."), { recursive: true });
  writeFileSync(wikiJoin(relPath), formatWikiPage(data), "utf8");
}

function setupHealthyWiki(): void {
  mkdirSync(wikiJoin("concepts"), { recursive: true });
  writePage("concepts/alpha.md", {
    title: "Alpha",
    summary: "Alpha summary.",
    tags: ["concepts"],
    created: "2026-08-01",
    updated: "2026-08-01",
    keyPoints: ["One", "Two", "Three", "Four", "Five"],
    connections: [{ path: "beta.md", description: "related" }],
  });
  writePage("concepts/beta.md", {
    title: "Beta",
    summary: "Beta summary.",
    tags: ["concepts"],
    created: "2026-08-01",
    updated: "2026-08-01",
    keyPoints: ["One", "Two", "Three", "Four", "Five"],
    connections: [{ path: "alpha.md", description: "related back" }],
  });
  regenerateWikiIndex(root);
}

describe("wikiCheck", () => {
  it("returns empty report when wiki does not exist", () => {
    const report = wikiCheck(root);
    expect(report.stats.totalPages).toBe(0);
    expect(report.orphans).toEqual([]);
  });

  it("detects orphan pages not listed in index", () => {
    setupHealthyWiki();
    writeFileSync(
      wikiJoin("index.md"),
      `# Wiki

## Concepts
- [Alpha](concepts/alpha.md) — Alpha summary.
`,
      "utf8",
    );

    const report = wikiCheck(root);
    expect(report.orphans).toContain("concepts/beta.md");
  });

  it("detects ghost index entries with no file", () => {
    setupHealthyWiki();
    writeFileSync(
      wikiJoin("index.md"),
      `# Wiki

## Concepts
- [Alpha](concepts/alpha.md) — Alpha summary.
- [Missing](concepts/missing.md) — Gone.
`,
      "utf8",
    );

    const report = wikiCheck(root);
    expect(report.ghosts).toContain("concepts/missing.md");
  });

  it("detects broken internal links", () => {
    setupHealthyWiki();
    writePage("concepts/alpha.md", {
      title: "Alpha",
      summary: "Alpha summary.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
      connections: [{ path: "nonexistent.md", description: "broken" }],
    });
    regenerateWikiIndex(root);

    const report = wikiCheck(root);
    expect(report.brokenLinks.some((b) => b.fromPage === "concepts/alpha.md")).toBe(true);
  });

  it("detects missing backlinks", () => {
    setupHealthyWiki();
    writePage("concepts/beta.md", {
      title: "Beta",
      summary: "Beta summary.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(root);

    const report = wikiCheck(root);
    expect(report.missingBacklinks).toEqual([
      expect.objectContaining({ fromPage: "concepts/alpha.md", toPage: "concepts/beta.md" }),
    ]);
  });

  it("detects frontmatter integrity issues", () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    writeFileSync(
      wikiJoin("concepts/bad.md"),
      `---
tags: []
sources: []
created:
updated:
summary:
---

# Bad
`,
      "utf8",
    );
    regenerateWikiIndex(root);

    const report = wikiCheck(root);
    expect(report.frontmatterIssues.length).toBeGreaterThanOrEqual(3);
    expect(report.frontmatterIssues.some((i) => i.page === "concepts/bad.md")).toBe(true);
  });

  it("detects unresolved sources", () => {
    writePage("concepts/source.md", {
      title: "Source",
      summary: "Has missing source.",
      tags: ["concepts"],
      sources: ["user/missing-note.md"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(root);

    const report = wikiCheck(root);
    expect(report.unresolvedSources).toEqual([
      expect.objectContaining({ page: "concepts/source.md", source: "user/missing-note.md" }),
    ]);
  });

  it("detects thin pages", () => {
    writePage("concepts/thin.md", {
      title: "Thin",
      summary: "Too short.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["Only one"],
    });
    regenerateWikiIndex(root);

    const report = wikiCheck(root);
    expect(report.thinPages).toContain("concepts/thin.md");
    expect(WIKI_THIN_PAGE_MIN_LINES).toBe(5);
  });

  it("computes connectivity stats", () => {
    setupHealthyWiki();
    const report = wikiCheck(root);
    expect(report.stats.totalPages).toBe(2);
    expect(report.stats.totalConnections).toBe(2);
    expect(report.stats.bidirectionalPct).toBe(100);
    expect(report.stats.categories).toBe(1);
  });
});

describe("wikiRepairLinks", () => {
  it("adds missing backlinks", () => {
    setupHealthyWiki();
    writePage("concepts/beta.md", {
      title: "Beta",
      summary: "Beta summary.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(root);

    const report = wikiCheck(root);
    const result = wikiRepairLinks(root, report);
    expect(result.backlinksAdded).toBe(1);

    const beta = readFileSync(wikiJoin("concepts/beta.md"), "utf8");
    expect(beta).toContain("alpha.md");
  });

  it("fixes broken links by slug similarity", () => {
    setupHealthyWiki();
    writePage("concepts/alpha.md", {
      title: "Alpha",
      summary: "Alpha summary.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
      connections: [{ path: "concepts/beta.md", description: "wiki-root path" }],
    });
    regenerateWikiIndex(root);

    const report = wikiCheck(root);
    expect(report.brokenLinks.length).toBeGreaterThan(0);

    const result = wikiRepairLinks(root, report);
    expect(result.brokenLinksFixed).toBe(1);

    const after = wikiCheck(root);
    expect(after.brokenLinks).toEqual([]);
  });

  it("regenerates index when orphans or ghosts exist", () => {
    setupHealthyWiki();
    writeFileSync(
      wikiJoin("index.md"),
      `# Wiki

## Concepts
- [Alpha](concepts/alpha.md) — Alpha summary.
`,
      "utf8",
    );

    const report = wikiCheck(root);
    const result = wikiRepairLinks(root, report);
    expect(result.indexRegenerated).toBe(true);

    const index = readFileSync(wikiJoin("index.md"), "utf8");
    expect(index).toContain("beta.md");
    expect(report.orphans.length).toBeGreaterThan(0);
  });
});
