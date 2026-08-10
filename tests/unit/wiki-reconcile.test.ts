// tests/unit/wiki-reconcile.test.ts — reconciliation, enrichment, backlinks.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WIKI_DIR } from "../../shared/brain-paths";
import { formatWikiPage, WIKI_CONTENT_LINE_GUARD } from "../../backends/wiki-format";
import {
  addBacklinks,
  createWikiPage,
  enrichPage,
  findMatchingPage,
  readWikiPage,
} from "../../backends/wiki-reconcile";
import { bootstrapWiki } from "../../backends/wiki-file";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "wiki-reconcile-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function wikiJoin(...parts: string[]): string {
  return join(root, WIKI_DIR, ...parts);
}

describe("findMatchingPage", () => {
  it("matches normalized titles", () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    writeFileSync(
      wikiJoin("concepts", "spark.md"),
      formatWikiPage({
        title: "Spark",
        summary: "An idea.",
        tags: ["ideas"],
        created: "2026-08-10",
        updated: "2026-08-10",
      }),
      "utf8",
    );
    expect(findMatchingPage(root, "spark", [])?.relPath).toBe("concepts/spark.md");
  });
});

describe("enrichPage", () => {
  it("appends key points and set-unions tags", () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    writeFileSync(
      wikiJoin("concepts", "spark.md"),
      formatWikiPage({
        title: "Spark",
        summary: "Original summary.",
        tags: ["ideas"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["First point."],
      }),
      "utf8",
    );

    enrichPage(root, "concepts/spark.md", {
      keyPoints: ["Second point."],
      tags: ["new-tag"],
      updated: "2026-08-10",
    });

    const content = readWikiPage(root, "concepts/spark.md");
    expect(content).toContain("First point.");
    expect(content).toContain("Second point.");
    expect(content).toContain("Original summary.");
    expect(content).toContain("ideas");
    expect(content).toContain("new-tag");
    expect(content).toContain("updated: 2026-08-10");
  });

  it("enriches Spanish-headed pages using positional parsing", () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    writeFileSync(
      wikiJoin("concepts", "atractor.md"),
      formatWikiPage(
        {
          title: "Atractor",
          summary: "Resumen original.",
          tags: ["sistemas-complejos"],
          created: "2026-08-01",
          updated: "2026-08-01",
          keyPoints: ["Primer punto."],
        },
        "es",
      ),
      "utf8",
    );

    enrichPage(
      root,
      "concepts/atractor.md",
      {
        keyPoints: ["Segundo punto."],
        updated: "2026-08-10",
      },
      "es",
    );

    const content = readWikiPage(root, "concepts/atractor.md");
    expect(content).toContain("Primer punto.");
    expect(content).toContain("Segundo punto.");
    expect(content).toContain("## Puntos clave");
    expect(content).not.toContain("## Key points");
  });

  it("aborts when size guard would be exceeded", () => {
    const keyPoints = Array.from({ length: WIKI_CONTENT_LINE_GUARD - 1 }, (_, i) => `Line ${i}`);
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    writeFileSync(
      wikiJoin("concepts", "large.md"),
      formatWikiPage({
        title: "Large",
        summary: "Big page.",
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints,
      }),
      "utf8",
    );

    const result = enrichPage(root, "concepts/large.md", {
      keyPoints: ["One more line."],
      updated: "2026-08-10",
    });
    expect(result.action).toBe("too-large");
  });
});

describe("addBacklinks", () => {
  it("adds bidirectional links", () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    writeFileSync(
      wikiJoin("concepts", "beta.md"),
      formatWikiPage({
        title: "Beta",
        summary: "Beta.",
        tags: ["concepts"],
        created: "2026-08-10",
        updated: "2026-08-10",
      }),
      "utf8",
    );
    createWikiPage(root, {
      title: "Alpha",
      summary: "Alpha.",
      tags: ["concepts"],
      category: "concepts",
      created: "2026-08-10",
      updated: "2026-08-10",
      connections: [{ path: "beta.md", description: "related" }],
    });

    addBacklinks(root, "concepts/alpha.md", [{ path: "beta.md", description: "related" }], "Alpha");
    const beta = readWikiPage(root, "concepts/beta.md");
    expect(beta).toContain("alpha.md");
  });
});

describe("bootstrapWiki", () => {
  it("creates wiki structure on first use", () => {
    bootstrapWiki(root);
    expect(readFileSync(wikiJoin("index.md"), "utf8")).toContain("# Wiki");
    expect(readFileSync(wikiJoin(".meta", "log.md"), "utf8")).toContain("# Wiki log");
  });
});
