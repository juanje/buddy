// shared/dashboard/parse.ts — Split dashboard markdown (FR-DASH-01).

import { splitFrontmatter } from "../frontmatter";

export type ParsedDashboardPart =
  | { kind: "text"; markdown: string }
  | { kind: "dashboard_block"; yaml: string; fenceError?: string };

export type ParsedDashboardDocument = {
  title?: string;
  summary?: string;
  body: string;
};

const OPEN_DASHBOARD = /^```dashboard\s*$/;
const CLOSE_FENCE = /^```\s*$/;

/** Split the body into free text and ```dashboard blocks. Browser-safe. */
export function parseDashboardParts(body: string): ParsedDashboardPart[] {
  const parts: ParsedDashboardPart[] = [];
  const lines = body.split(/\r?\n/);
  let textBuf: string[] = [];
  let i = 0;

  const flushText = (): void => {
    const markdown = textBuf.join("\n").trim();
    if (markdown) parts.push({ kind: "text", markdown });
    textBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (OPEN_DASHBOARD.test(line.trim())) {
      flushText();
      i += 1;
      const yamlLines: string[] = [];
      let closed = false;
      while (i < lines.length) {
        if (CLOSE_FENCE.test(lines[i].trim())) {
          closed = true;
          i += 1;
          break;
        }
        yamlLines.push(lines[i]);
        i += 1;
      }
      if (!closed) {
        parts.push({
          kind: "dashboard_block",
          yaml: yamlLines.join("\n"),
          fenceError: "Unclosed ```dashboard fence",
        });
      } else {
        parts.push({ kind: "dashboard_block", yaml: yamlLines.join("\n") });
      }
      continue;
    }
    textBuf.push(line);
    i += 1;
  }
  flushText();
  return parts;
}

export function parseDashboardDocument(content: string): ParsedDashboardDocument {
  const { fields, body } = splitFrontmatter(content);
  return {
    title: fields.title,
    summary: fields.summary,
    body,
  };
}
