// tests/unit/wiki-format.test.ts — wiki page format utilities.

import { describe, expect, it } from "vitest";

import {
  WIKI_CONTENT_LINE_GUARD,
  WIKI_SUMMARY_MAX_LEN,
  contentLineCount,
  extractConnections,
  extractTitle,
  formatWikiPage,
  normalizeTitle,
  parseWikiFrontmatter,
  slugifyTitle,
  validateWikiSummary,
  validateWikiTags,
} from "../../backends/wiki-format";

describe("slugifyTitle", () => {
  it("lowercases, strips accents, and hyphenates", () => {
    expect(slugifyTitle("Sistemas Complejos")).toBe("sistemas-complejos");
    expect(slugifyTitle("Café con leche")).toBe("cafe-con-leche");
  });
});

describe("normalizeTitle", () => {
  it("matches titles regardless of accents and casing", () => {
    expect(normalizeTitle("Atractor")).toBe(normalizeTitle("atractor"));
    expect(normalizeTitle("Café")).toBe(normalizeTitle("cafe"));
  });
});

describe("formatWikiPage", () => {
  it("renders frontmatter and sections per D7", () => {
    const content = formatWikiPage({
      title: "Test Concept",
      summary: "A one-line summary.",
      tags: ["test", "concept"],
      sources: ["user/notes.md"],
      created: "2026-08-10",
      updated: "2026-08-10",
      intro: "This is the intro paragraph.",
      keyPoints: ["First point", "Second point"],
      examples: ["An example"],
      connections: [{ path: "../other/page.md", description: "related idea" }],
    });

    expect(content).toContain("tags: [test, concept]");
    expect(content).toContain("summary: A one-line summary.");
    expect(content).toContain("# Test Concept");
    expect(content).toContain("## Key points");
    expect(content).toContain("- First point");
    expect(content).toContain("## Examples");
    expect(content).toContain("## Connections");
    expect(content).toContain("[page](../other/page.md) — related idea");
  });

  it("rejects invalid tags and long summaries", () => {
    expect(() =>
      formatWikiPage({
        title: "Bad",
        summary: "ok",
        tags: ["Bad Tag"],
        created: "2026-08-10",
        updated: "2026-08-10",
      }),
    ).toThrow(/Invalid tag/);

    expect(validateWikiSummary("x".repeat(WIKI_SUMMARY_MAX_LEN + 1))).toMatch(/exceeds/);
    expect(validateWikiTags(["valid-tag"])).toBeNull();
  });
});

describe("parseWikiFrontmatter", () => {
  it("extracts inline and multiline list fields", () => {
    const inline = `---
tags: [alpha, beta]
sources: []
created: 2026-08-10
updated: 2026-08-10
summary: Inline tags.
---

# Page
`;
    expect(parseWikiFrontmatter(inline).tags).toEqual(["alpha", "beta"]);

    const multiline = `---
tags:
  - one
  - two
sources:
  - user/a.md
created: 2026-08-01
updated: 2026-08-10
summary: Multiline lists.
---

# Page
`;
    const fm = parseWikiFrontmatter(multiline);
    expect(fm.tags).toEqual(["one", "two"]);
    expect(fm.sources).toEqual(["user/a.md"]);
    expect(fm.summary).toBe("Multiline lists.");
  });
});

describe("extractTitle and contentLineCount", () => {
  it("reads H1 and counts content lines excluding Connections", () => {
    const content = `---
summary: s
---

# My Title

Intro line.

## Key points
- one

## Connections
- [x](y.md) — link
`;
    expect(extractTitle(content)).toBe("My Title");
    expect(contentLineCount(content)).toBeLessThan(WIKI_CONTENT_LINE_GUARD);
    expect(extractConnections(content)).toEqual([{ path: "y.md", description: "link" }]);
  });
});
