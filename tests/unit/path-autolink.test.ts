// tests/unit/path-autolink.test.ts — FR-CHAT-16.
//
// The feature file covers the sentence-level behaviour. This covers what it
// cannot reach conveniently: nested block structures, the title attribute, and
// the security property that matters most here — rewriting the token tree must
// not open a hole in NFR-SEC-10, since the output of renderMarkdown is bound
// with {@html}.

import { Marked } from "marked";
import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../../src/lib/markdown";
import { autolinkLabel, autolinkPathTokens } from "../../src/lib/path-autolink";

/**
 * The nesting guard, asserted on the token tree — where the guard actually
 * acts. The HTML assertion below covers the same property as the user would
 * meet it; both are kept, because the tree one keeps holding even if the link
 * renderer ever stops parsing its label tokens, which is the state that used to
 * hide nesting entirely.
 */
function linkTokensInside(markdown: string): unknown[] {
  const tokens = new Marked({ gfm: true, breaks: true }).lexer(markdown);
  autolinkPathTokens(tokens);
  const nested: unknown[] = [];
  const visit = (list: { type: string; tokens?: unknown[] }[], insideLink: boolean) => {
    for (const token of list) {
      if (token.type === "link" && insideLink) nested.push(token);
      if (token.tokens) {
        visit(token.tokens as typeof list, insideLink || token.type === "link");
      }
    }
  };
  visit(tokens as unknown as { type: string; tokens?: unknown[] }[], false);
  return nested;
}

describe("nesting guard", () => {
  it("creates no link inside a link the agent wrote", () => {
    expect(
      linkTokensInside("Mira [agent_brain/identity/USER.md](agent_brain/identity/USER.md)"),
    ).toEqual([]);
  });

  it("creates no link inside a link whose label merely mentions a path", () => {
    expect(linkTokensInside("Mira [ver user/inbox.md aquí](user/inbox.md)")).toEqual([]);
  });

  it("emits no anchor inside an anchor", () => {
    const html = renderMarkdown("Mira [ver user/inbox.md aquí](user/inbox.md)");
    expect(html.match(/<a\b/g)).toHaveLength(1);
  });
});

describe("autolinkLabel", () => {
  it("shows the file name for Buddy's own directories", () => {
    expect(autolinkLabel("agent_brain/identity/USER.md")).toBe("USER.md");
    expect(autolinkLabel("logs/2026-07-30.md")).toBe("2026-07-30.md");
  });

  it("shows the whole path for the user's own space", () => {
    expect(autolinkLabel("user/inbox.md")).toBe("user/inbox.md");
    expect(autolinkLabel("downloads/article.md")).toBe("downloads/article.md");
  });
});

describe("renderMarkdown path autolinking", () => {
  it("keeps the full path in the title when the label is shortened", () => {
    const html = renderMarkdown("Está en agent_brain/identity/USER.md");
    expect(html).toContain('title="agent_brain/identity/USER.md"');
    expect(html).toContain(">USER.md</a>");
  });

  it("adds no title when the label already is the path", () => {
    expect(renderMarkdown("Está en user/inbox.md")).not.toContain("title=");
  });

  it("links inside a list item", () => {
    const html = renderMarkdown("- Revisa user/inbox.md\n- Y nada más");
    expect(html).toContain('data-local-path="user/inbox.md"');
  });

  it("links inside a blockquote", () => {
    expect(renderMarkdown("> Está en user/inbox.md")).toContain('data-local-path="user/inbox.md"');
  });

  it("links inside a table cell", () => {
    const html = renderMarkdown("| File |\n| --- |\n| user/inbox.md |");
    expect(html).toContain('data-local-path="user/inbox.md"');
  });

  it("links inside emphasis", () => {
    expect(renderMarkdown("**Mira user/inbox.md**")).toContain('data-local-path="user/inbox.md"');
  });

  it("leaves a path in an indented code block alone", () => {
    const html = renderMarkdown("    user/inbox.md\n");
    expect(html).not.toContain("data-local-path");
  });

  // NFR-SEC-10: rewriting tokens must not let author-chosen markup through.
  it("still escapes raw HTML in a message that also contains a path", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> y user/inbox.md');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain('data-local-path="user/inbox.md"');
  });

  it("does not treat an html-escaped sequence as part of a path", () => {
    const html = renderMarkdown("a & b user/inbox.md");
    expect(html).toContain('data-local-path="user/inbox.md"');
    expect(html).toContain("&amp;");
  });

  // The href reaches an attribute, so a path shaped like an injection must not
  // survive as markup even if the pattern were ever loosened.
  it("produces an inert href for every autolinked path", () => {
    const html = renderMarkdown("Está en user/inbox.md");
    expect(html).toContain('<a href="#"');
    expect(html).not.toContain('href="user/inbox.md"');
  });

  it("leaves a message with no buddy paths byte-for-byte unchanged", () => {
    const plain = "Nada que enlazar aquí, solo texto.";
    expect(renderMarkdown(plain)).toBe("<p>Nada que enlazar aquí, solo texto.</p>\n");
  });
});
