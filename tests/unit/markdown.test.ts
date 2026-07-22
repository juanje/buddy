// tests/unit/markdown.test.ts — FR-CHAT-04 markdown rendering.

import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../../src/lib/markdown";

describe("renderMarkdown", () => {
  it("renders bold and italic", () => {
    const html = renderMarkdown("Hello **bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders headings and lists", () => {
    const html = renderMarkdown("## Title\n\n- one\n- two");
    expect(html).toContain("<h2");
    expect(html).toContain("Title");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders fenced code blocks with highlighting", () => {
    const html = renderMarkdown("```json\n{\"a\": 1}\n```");
    expect(html).toContain("<pre><code");
    expect(html).toContain("language-json");
  });

  it("renders external links with target blank", () => {
    const html = renderMarkdown("[docs](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
  });

  it("renders local links with data-local-path and no target blank", () => {
    const html = renderMarkdown("[skill](agent_brain/skills/foo.md)");
    expect(html).toContain('data-local-path="agent_brain/skills/foo.md"');
    expect(html).not.toContain('target="_blank"');
  });

  it("returns empty string for blank input", () => {
    expect(renderMarkdown("   ")).toBe("");
  });
});
