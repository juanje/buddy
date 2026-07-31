// src/lib/markdown.ts — Markdown → HTML for assistant bubbles (FR-CHAT-04)
// and the inline file viewer (FR-CHAT-10).
//
// NFR-SEC-10: the output of this module is bound with {@html}, so it is the
// last layer before the DOM. Its input is attacker-influenced — assistant
// replies are shaped by whatever fetch_url pulled in, and the file viewer
// renders files the agent wrote. Nothing here may produce markup the author of
// that content chose.
//
// Raw HTML is neutralized at the token level rather than post-hoc with a
// sanitizer: marked routes every raw HTML construct (block and inline) through
// the `html` renderer hook, so escaping there is complete by construction and
// needs no DOM. Escaping rather than dropping keeps an injection attempt
// visible to the user.

import { Marked } from "marked";

import { isExternalHref } from "./local-path";
import { autolinkPathTokens } from "./path-autolink";

/** Escape text destined for an HTML text node. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape a value destined for a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdownLang from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdownLang);
hljs.registerLanguage("md", markdownLang);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);

const parser = new Marked({
  breaks: true,
  gfm: true,
  renderer: {
    /**
     * Raw HTML — both block-level and inline. Escaped, never emitted. This is
     * the single hook every raw-HTML construct passes through, so overriding it
     * neutralizes the whole class (NFR-SEC-10).
     */
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, text, tokens }) {
      const safeHref = href ?? "#";
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      // The label is markdown and has to be parsed as such. Reading `text` off
      // the token gives the raw source instead, which is why `[**bold**](x)`
      // used to render its asterisks and a code-span label kept its backticks
      // on screen. Raw HTML inside a label still passes through the `html` hook
      // above, so NFR-SEC-10 is unaffected.
      const label = tokens?.length ? this.parser.parseInline(tokens) : escapeHtml(text ?? "");
      if (isExternalHref(safeHref)) {
        return `<a href="${escapeAttr(safeHref)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${label}</a>`;
      }
      // Local links carry the target in a data attribute and an inert href, so
      // a `javascript:` or `data:` URL can never become a navigable target.
      // The worker validates the path before anything is read (FR-CHAT-11).
      return `<a href="#" data-local-path="${escapeAttr(safeHref)}"${titleAttr}>${label}</a>`;
    },
    code({ text, lang }) {
      const language = lang?.trim();
      const highlighted =
        language && hljs.getLanguage(language)
          ? hljs.highlight(text, { language }).value
          : hljs.highlightAuto(text).value;
      // `language` comes from the fence info string — author-controlled, so it
      // must be escaped before it lands in an attribute.
      const langClass = language ? ` class="language-${escapeAttr(language)}"` : "";
      return `<pre><code${langClass}>${highlighted}</code></pre>`;
    },
  },
});

/** Render assistant markdown to HTML for {@html} binding. */
export function renderMarkdown(text: string): string {
  if (!text.trim()) return "";
  // Lex and parse in two steps so bare buddy paths can be turned into links on
  // the token tree (FR-CHAT-16). Doing it on the rendered HTML instead would
  // put an anchor inside an anchor the agent wrote.
  const tokens = parser.lexer(text);
  autolinkPathTokens(tokens);
  return parser.parser(tokens);
}
