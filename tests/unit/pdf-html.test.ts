// tests/unit/pdf-html.test.ts — FR-CHAT-18 PDF HTML wrapper.

import { describe, expect, it } from "vitest";

import { buildPdfHtml } from "../../src/lib/pdf-html";

describe("buildPdfHtml", () => {
  const html = buildPdfHtml("<h1>Hello</h1><p>Body</p>");

  it("wraps in a complete HTML document with charset", () => {
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/charset="utf-8"/i);
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
  });

  it("uses hardcoded light-theme styles, not CSS variables", () => {
    expect(html).toContain("<style>");
    expect(html).not.toContain("var(--");
  });

  it("fills the A4-wide webview instead of a centered max-width box", () => {
    expect(html).not.toContain("max-width: 520px");
    expect(html).toContain("padding: 48pt 54pt");
  });

  it("includes break-inside:avoid for block elements", () => {
    expect(html).toMatch(/break-inside:\s*avoid/);
    expect(html).toContain("h1");
    expect(html).toContain("pre");
    expect(html).toContain("blockquote");
    expect(html).toContain("table");
  });

  it("preserves the rendered body HTML", () => {
    expect(html).toContain("<h1>Hello</h1><p>Body</p>");
  });
});
