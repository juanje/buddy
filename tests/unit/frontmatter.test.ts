// tests/unit/frontmatter.test.ts — shared/frontmatter (FR-CHAT-15).
//
// `parseFrontmatter` and its first test moved here from reflect.test.ts when the
// function left `backends/reflect.ts` for `shared/`, so the file viewer could
// reach it without a second implementation.

import { describe, expect, it } from "vitest";

import { parseFrontmatter, splitFrontmatter } from "../../shared/frontmatter";

describe("parseFrontmatter", () => {
  it("parses yaml frontmatter fields", () => {
    const fm = parseFrontmatter("---\ndate: 2026-07-23\nstatus: active\n---\n");
    expect(fm.date).toBe("2026-07-23");
    expect(fm.status).toBe("active");
  });

  it("returns nothing for a document without frontmatter", () => {
    expect(parseFrontmatter("# Title\n\nBody")).toEqual({});
  });

  it("keeps a value containing a colon whole", () => {
    const fm = parseFrontmatter('---\nsummary: "Buddy: what it holds"\n---\n');
    expect(fm.summary).toBe('"Buddy: what it holds"');
  });
});

describe("splitFrontmatter", () => {
  it("separates the block from the body", () => {
    const { fields, body } = splitFrontmatter(
      "---\nsummary: What this holds\naccess_count: 4\n---\n\n# Title\n\nBody",
    );
    expect(fields.summary).toBe("What this holds");
    expect(body).toBe("# Title\n\nBody");
  });

  it("returns a document without frontmatter unchanged", () => {
    const content = "# Title\n\nBody";
    const { fields, body } = splitFrontmatter(content);
    expect(fields).toEqual({});
    expect(body).toBe(content);
  });

  it("leaves a leading horizontal rule alone", () => {
    // `---` with no closing delimiter is content the author wanted seen, not an
    // unterminated metadata block.
    const content = "---\n\n# Title";
    expect(splitFrontmatter(content).body).toBe(content);
  });

  it("handles CRLF line endings", () => {
    const { fields, body } = splitFrontmatter("---\r\nsummary: Yes\r\n---\r\n\r\nBody");
    expect(fields.summary).toBe("Yes");
    expect(body).toBe("Body");
  });

  it("keeps a body that itself contains a horizontal rule", () => {
    const { body } = splitFrontmatter("---\nsummary: Yes\n---\n\nAbove\n\n---\n\nBelow");
    expect(body).toBe("Above\n\n---\n\nBelow");
  });

  it("does not swallow content when the body starts immediately", () => {
    expect(splitFrontmatter("---\nsummary: Yes\n---\nBody").body).toBe("Body");
  });
});
