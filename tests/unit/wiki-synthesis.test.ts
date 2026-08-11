// tests/unit/wiki-synthesis.test.ts — FR-WIKI-06 wiki synthesis candidates.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WIKI_DIR } from "../../shared/brain-paths";
import {
  wikiSynthesisCandidates,
  WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES,
  WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES,
} from "../../backends/wiki-synthesis";
import { formatWikiPage } from "../../backends/wiki-format";
import { regenerateWikiIndex } from "../../backends/wiki-index";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "wiki-synthesis-"));
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

describe("wikiSynthesisCandidates", () => {
  it("returns no candidates for empty wiki", () => {
    expect(wikiSynthesisCandidates(root)).toEqual([]);
  });

  it("detects orphan tag with 3+ pages", () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    for (let i = 1; i <= WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES; i++) {
      writePage(`concepts/page-${i}.md`, {
        title: `Page ${i}`,
        summary: `Summary ${i}.`,
        tags: ["emergence", "concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    const orphan = candidates.find((c) => c.type === "orphan-tag" && c.label === "emergence");
    expect(orphan).toBeDefined();
    expect(orphan!.score).toBe(WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES);
    expect(orphan!.relatedPages).toHaveLength(WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES);
  });

  it("excludes tag that has a matching page title", () => {
    writePage("concepts/concepts.md", {
      title: "Concepts",
      summary: "Concepts hub.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    for (let i = 1; i <= 3; i++) {
      writePage(`concepts/other-${i}.md`, {
        title: `Other ${i}`,
        summary: `Other ${i}.`,
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    expect(candidates.some((c) => c.type === "orphan-tag" && c.label === "concepts")).toBe(false);
  });

  it("detects co-occurring tag pair on 3+ pages", () => {
    for (let i = 1; i <= WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES; i++) {
      writePage(`concepts/pair-${i}.md`, {
        title: `Pair ${i}`,
        summary: `Pair ${i}.`,
        tags: ["feedback", "systems"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    const pair = candidates.find((c) => c.type === "co-occurrence" && c.label === "feedback + systems");
    expect(pair).toBeDefined();
    expect(pair!.score).toBe(WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES);
  });

  it("detects disconnected pages sharing tags", () => {
    writePage("concepts/alpha.md", {
      title: "Alpha",
      summary: "Alpha page.",
      tags: ["complex-systems", "attractors"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    writePage("concepts/beta.md", {
      title: "Beta",
      summary: "Beta page.",
      tags: ["complex-systems", "attractors"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    const cluster = candidates.find((c) => c.type === "disconnected-cluster");
    expect(cluster).toBeDefined();
    expect(cluster!.relatedPages).toEqual(
      expect.arrayContaining(["concepts/alpha.md", "concepts/beta.md"]),
    );
  });

  it("sorts candidates by score descending", () => {
    for (let i = 1; i <= 4; i++) {
      writePage(`concepts/em-${i}.md`, {
        title: `Emergence ${i}`,
        summary: `E ${i}.`,
        tags: ["emergence"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    writePage("concepts/a.md", {
      title: "A",
      summary: "A.",
      tags: ["feedback", "systems"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    writePage("concepts/b.md", {
      title: "B",
      summary: "B.",
      tags: ["feedback", "systems"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    writePage("concepts/c.md", {
      title: "C",
      summary: "C.",
      tags: ["feedback", "systems"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score);
    }
  });
});
