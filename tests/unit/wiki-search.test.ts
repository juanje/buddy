// tests/unit/wiki-search.test.ts — FR-WIKI-04 search logic.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WIKI_DIR } from "../../shared/brain-paths";
import { formatWikiPage } from "../../backends/wiki-format";
import { searchWikiPages } from "../../backends/wiki-search";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "wiki-search-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writePage(category: string, slug: string, title: string, bodyExtra: string, tags: string[]): void {
  const dir = join(root, WIKI_DIR, category);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${slug}.md`),
    formatWikiPage({
      title,
      summary: `${title} summary.`,
      tags,
      created: "2026-08-10",
      updated: "2026-08-10",
      keyPoints: [bodyExtra],
    }),
    "utf8",
  );
}

describe("searchWikiPages", () => {
  it("returns metadata only — never page bodies in formatted output path", () => {
    writePage("ideas", "spark", "Spark", "Secret body line.", ["ideas"]);
    const { results, total } = searchWikiPages(root, "spark");
    expect(total).toBe(1);
    expect(results[0].title).toBe("Spark");
    expect(results[0].summary).toContain("Spark summary");
    const fileContent = readFileSync(join(root, WIKI_DIR, "ideas/spark.md"), "utf8");
    expect(fileContent).toContain("Secret body line.");
  });

  it("returns empty on missing wiki", () => {
    expect(searchWikiPages(root, "anything")).toEqual({ results: [], total: 0 });
  });

  it("scopes tag search to tags only", () => {
    writePage("concepts", "alpha", "Alpha", "unique-body-token", ["shared-tag"]);
    writePage("concepts", "beta", "Beta", "shared-tag appears here too", ["other"]);

    expect(searchWikiPages(root, "shared-tag", "tags").total).toBe(1);
    expect(searchWikiPages(root, "other", "tags").total).toBe(1);
    expect(searchWikiPages(root, "unique-body-token", "tags").total).toBe(0);
    expect(searchWikiPages(root, "unique-body-token", "content").total).toBe(1);
  });
});
