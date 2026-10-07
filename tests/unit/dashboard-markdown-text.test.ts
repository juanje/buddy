// tests/unit/dashboard-markdown-text.test.ts — FR-DASH-10 text widget safety

import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../../src/lib/markdown";
import { hasElement } from "../support/rendered-markup";

describe("dashboard text widget markdown", () => {
  it("escapes script tags in output", () => {
    const html = renderMarkdown('Hello <script>alert(1)</script>');
    expect(hasElement(html, "script")).toBe(false);
    expect(html).toMatch(/&lt;script&gt;/);
  });
});
