// src/lib/markdown.ts — Markdown → HTML for assistant bubbles (FR-CHAT-04).

import { Marked } from "marked";
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
    link({ href, title, text }) {
      const safeHref = href ?? "#";
      const titleAttr = title ? ` title="${title}"` : "";
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    },
    code({ text, lang }) {
      const language = lang?.trim();
      const highlighted =
        language && hljs.getLanguage(language)
          ? hljs.highlight(text, { language }).value
          : hljs.highlightAuto(text).value;
      const langClass = language ? ` class="language-${language}"` : "";
      return `<pre><code${langClass}>${highlighted}</code></pre>`;
    },
  },
});

/** Render assistant markdown to HTML for {@html} binding. */
export function renderMarkdown(text: string): string {
  if (!text.trim()) return "";
  return parser.parse(text) as string;
}
