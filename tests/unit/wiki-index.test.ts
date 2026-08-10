// tests/unit/wiki-index.test.ts — wiki index regeneration.

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WIKI_DIR, WIKI_GLOSSARY, WIKI_INDEX, WIKI_TAGS } from "../../shared/brain-paths";
import {
  firstSentence,
  listWikiPageRelPaths,
  loadWikiPages,
  regenerateWikiIndex,
  renderGlossary,
  renderWikiIndex,
} from "../../backends/wiki-index";
import { formatWikiPage } from "../../backends/wiki-format";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "wiki-index-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writePage(category: string, slug: string, title: string, summary: string, tags: string[]): void {
  const wikiDir = join(root, WIKI_DIR, category);
  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(
    join(wikiDir, `${slug}.md`),
    formatWikiPage({
      title,
      summary,
      tags,
      created: "2026-08-10",
      updated: "2026-08-10",
    }),
    "utf8",
  );
}

describe("firstSentence", () => {
  it("returns text up to the first sentence boundary", () => {
    expect(firstSentence("First idea. Second idea.")).toBe("First idea.");
    expect(firstSentence("Ends with period.")).toBe("Ends with period.");
  });

  it("falls back to truncated summary when no period is found", () => {
    const long = "x".repeat(210);
    expect(firstSentence(long)).toBe(`${"x".repeat(197)}...`);
  });
});

describe("listWikiPageRelPaths", () => {
  it("skips meta files and hidden directories", () => {
    writePage("concepts", "alpha", "Alpha", "First concept.", ["alpha"]);
    mkdirSync(join(root, WIKI_DIR, ".meta"), { recursive: true });
    writeFileSync(join(root, WIKI_DIR, "index.md"), "# Wiki\n", "utf8");

    const pages = listWikiPageRelPaths(join(root, WIKI_DIR));
    expect(pages).toEqual(["concepts/alpha.md"]);
  });
});

describe("renderGlossary", () => {
  it("uses the first sentence of each summary", () => {
    const rendered = renderGlossary([
      {
        relPath: "concepts/alpha.md",
        title: "Alpha",
        summary: "First sentence. Second sentence.",
        tags: [],
        category: "concepts",
        connections: [],
      },
    ]);
    expect(rendered).toContain("**[Alpha](concepts/alpha.md)** — First sentence.");
    expect(rendered).not.toContain("Second sentence.");
  });

  it("uses Spanish heading when language is es", () => {
    const rendered = renderGlossary([], "es");
    expect(rendered).toContain("# Glosario");
    expect(rendered).not.toContain("# Glossary");
  });
});

describe("regenerateWikiIndex", () => {
  it("rebuilds index and glossary but not tags.md", () => {
    writePage("concepts", "alpha", "Alpha", "First concept.", ["alpha"]);
    writePage("concepts", "beta", "Beta", "Second concept.", ["beta", "shared"]);

    regenerateWikiIndex(root);

    const index = readFileSync(join(root, WIKI_INDEX), "utf8");
    expect(index).toContain("## Concepts");
    expect(index).toContain("[Alpha](concepts/alpha.md) — First concept.");

    expect(existsSync(join(root, WIKI_TAGS))).toBe(false);

    const glossary = readFileSync(join(root, WIKI_GLOSSARY), "utf8");
    expect(glossary).toContain("**[Alpha](concepts/alpha.md)**");
    expect(glossary).toContain("**[Beta](concepts/beta.md)**");
  });

  it("localizes glossary heading for Spanish instances", () => {
    writePage("concepts", "alpha", "Alpha", "Primer concepto.", ["alpha"]);
    regenerateWikiIndex(root, new Date(), "es");

    const glossary = readFileSync(join(root, WIKI_GLOSSARY), "utf8");
    expect(glossary).toContain("# Glosario");
  });

  it("loadWikiPages returns metadata for search", () => {
    writePage("ideas", "spark", "Spark", "An idea.", ["ideas"]);
    const pages = loadWikiPages(root);
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe("Spark");
    expect(pages[0].category).toBe("ideas");
  });

  it("renderWikiIndex groups by category", () => {
    const rendered = renderWikiIndex([
      {
        relPath: "a/one.md",
        title: "One",
        summary: "First",
        tags: [],
        category: "a",
        connections: [],
      },
      {
        relPath: "b/two.md",
        title: "Two",
        summary: "Second",
        tags: [],
        category: "b",
        connections: [],
      },
    ]);
    expect(rendered).toContain("## A");
    expect(rendered).toContain("## B");
  });
});
