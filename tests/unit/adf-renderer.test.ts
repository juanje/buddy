// tests/unit/adf-renderer.test.ts — FR-JIRA-03 ADF rendering.

import { describe, expect, it } from "vitest";

import { renderAdfToText } from "../../backends/connectors/adf-renderer";

describe("ADF renderer (FR-JIRA-03)", () => {
  it("renders paragraph text", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    };
    expect(renderAdfToText(doc)).toBe("Hello");
  });

  it("renders headings with markdown prefix", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    expect(renderAdfToText(doc)).toBe("## Title");
  });

  it("renders bullet lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }],
            },
          ],
        },
      ],
    };
    expect(renderAdfToText(doc)).toBe("- One");
  });

  it("applies bold and code marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "strong" }] },
            { type: "text", text: " code", marks: [{ type: "code" }] },
          ],
        },
      ],
    };
    expect(renderAdfToText(doc)).toBe("**bold**` code`");
  });

  it("falls back for unknown node types with content", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "customPanel",
          content: [{ type: "paragraph", content: [{ type: "text", text: "inside" }] }],
        },
      ],
    };
    expect(renderAdfToText(doc)).toContain("inside");
  });
});
