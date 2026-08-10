// tests/unit/wiki-index.test.ts — wiki index regeneration.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WIKI_DIR, WIKI_GLOSSARY, WIKI_INDEX, WIKI_TAGS } from "../../shared/brain-paths";
import {
  listWikiPageRelPaths,
  loadWikiPages,
  regenerateWikiIndex,
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

describe("listWikiPageRelPaths", () => {
  it("skips meta files and hidden directories", () => {
    writePage("concepts", "alpha", "Alpha", "First concept.", ["alpha"]);
    mkdirSync(join(root, WIKI_DIR, ".meta"), { recursive: true });
    writeFileSync(join(root, WIKI_DIR, "index.md"), "# Wiki\n", "utf8");

    const pages = listWikiPageRelPaths(join(root, WIKI_DIR));
    expect(pages).toEqual(["concepts/alpha.md"]);
  });
});

describe("regenerateWikiIndex", () => {
  it("rebuilds index, tags, and glossary from pages", () => {
    writePage("concepts", "alpha", "Alpha", "First concept.", ["alpha"]);
    writePage("concepts", "beta", "Beta", "Second concept.", ["beta", "shared"]);

    regenerateWikiIndex(root);

    const index = readFileSync(join(root, WIKI_INDEX), "utf8");
    expect(index).toContain("## Concepts");
    expect(index).toContain("[Alpha](concepts/alpha.md) — First concept.");

    const tags = readFileSync(join(root, WIKI_TAGS), "utf8");
    expect(tags).toContain("## alpha");
    expect(tags).toContain("[Alpha](concepts/alpha.md)");

    const glossary = readFileSync(join(root, WIKI_GLOSSARY), "utf8");
    expect(glossary).toContain("**[Alpha](concepts/alpha.md)**");
    expect(glossary).toContain("**[Beta](concepts/beta.md)**");
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
