// tests/unit/markdown-safety.test.ts — NFR-SEC-10 render safety.
//
// renderMarkdown output is bound with {@html}. Its input is attacker-influenced
// (assistant replies shaped by fetched web content, files the agent wrote), so
// the adversarial cases here are the point of the module, not an extra.
//
// Assertions inspect the parsed DOM rather than substrings: escaped output
// legitimately still reads like markup while forming no element.

import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../../src/lib/markdown";
import {
  hasDangerousUrlScheme,
  hasElement,
  hasEventHandlerAttribute,
  inspectRenderedMarkup,
} from "../support/rendered-markup";

const INJECTIONS = [
  ['<img src=x onerror="alert(1)">', "img"],
  ["<script>alert(1)</script>", "script"],
  ['<iframe src="https://evil.example"></iframe>', "iframe"],
  ['text with <span onclick="x">span</span>', "span"],
  ['<svg onload="alert(1)"></svg>', "svg"],
  ['<a href="javascript:alert(1)">x</a>', "a"],
  ["<div>block</div>", "div"],
  ['<object data="evil.swf"></object>', "object"],
  ['<style>body{background:url("x")}</style>', "style"],
] as const;

describe("renderMarkdown — raw HTML forms no element", () => {
  it.each(INJECTIONS)("neutralizes %s", (input, tag) => {
    expect(hasElement(renderMarkdown(input), tag)).toBe(false);
  });

  it.each(INJECTIONS)("produces no event-handler attribute for %s", (input) => {
    expect(hasEventHandlerAttribute(renderMarkdown(input))).toBe(false);
  });

  it("escapes rather than drops, so the attempt stays visible", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).toContain("&lt;script&gt;");
  });
});

describe("renderMarkdown — code fence language", () => {
  it("forms no element from a crafted language", () => {
    const html = renderMarkdown('```js"><script>alert(1)</script>\nx\n```');
    expect(hasElement(html, "script")).toBe(false);
    // The language lands in an attribute; it must be escaped there.
    expect(html).toContain("&quot;");
  });

  it("still emits a language class for a normal language", () => {
    expect(renderMarkdown("```python\nx = 1\n```")).toContain('class="language-python"');
  });
});

describe("renderMarkdown — ordinary markdown keeps working", () => {
  it("renders headings, emphasis and lists", () => {
    const html = renderMarkdown("# Title\n\nSome **bold** text.\n\n- one\n- two");
    expect(hasElement(html, "h1")).toBe(true);
    expect(hasElement(html, "strong")).toBe(true);
    expect(hasElement(html, "li")).toBe(true);
  });

  it("renders fenced code with highlighting", () => {
    const html = renderMarkdown("```js\nconst x = 1;\n```");
    expect(hasElement(html, "pre")).toBe(true);
    expect(hasElement(html, "code")).toBe(true);
  });

  it("returns empty string for blank input", () => {
    expect(renderMarkdown("   ")).toBe("");
  });
});

describe("renderMarkdown — link handling survives sanitization", () => {
  it("keeps data-local-path on local links (FR-CHAT-09/10 regression guard)", () => {
    const html = renderMarkdown("[notes](agent_brain/concepts/foo.md)");
    expect(html).toContain('data-local-path="agent_brain/concepts/foo.md"');
    expect(inspectRenderedMarkup(html).attributeNames).toContain("data-local-path");
  });

  it("marks external links with safe rel attributes", () => {
    const html = renderMarkdown("[site](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it.each([
    "[click](javascript:alert(1))",
    "[click](JaVaScRiPt:alert(1))",
    "[click](data:text/html;base64,PHNjcmlwdD4=)",
    "[click](vbscript:msgbox)",
  ])("never produces a dangerous URL scheme for %s", (input) => {
    expect(hasDangerousUrlScheme(renderMarkdown(input))).toBe(false);
  });
});
