// shared/dashboard/parse.ts — Split dashboard markdown (FR-DASH-01).

import { splitFrontmatter } from "../frontmatter";

export type ParsedDashboardPart =
  | { kind: "text"; markdown: string }
  | {
      kind: "dashboard_block";
      /** 1-based index among ```dashboard blocks in the body. */
      block: number;
      yaml: string;
      fenceError?: string;
      /** 1-based line in the body where the opening fence starts. */
      startLine: number;
      /** 1-based line in the body where the closing fence ends. */
      endLine: number;
      /** 1-based first line of YAML inside the fence (inclusive). */
      yamlStartLine: number;
      /** 1-based last line of YAML inside the fence (inclusive). */
      yamlEndLine: number;
    };

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
  let blockNum = 0;

  const flushText = (): void => {
    const markdown = textBuf.join("\n").trim();
    if (markdown) parts.push({ kind: "text", markdown });
    textBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (OPEN_DASHBOARD.test(line.trim())) {
      flushText();
      blockNum += 1;
      const startLine = i + 1;
      i += 1;
      const yamlStartLine = i + 1;
      const yamlLines: string[] = [];
      let closed = false;
      while (i < lines.length) {
        if (CLOSE_FENCE.test(lines[i].trim())) {
          closed = true;
          const endLine = i + 1;
          const yamlEndLine = yamlLines.length > 0 ? i : yamlStartLine - 1;
          parts.push({
            kind: "dashboard_block",
            block: blockNum,
            yaml: yamlLines.join("\n"),
            startLine,
            endLine,
            yamlStartLine,
            yamlEndLine,
          });
          i += 1;
          break;
        }
        yamlLines.push(lines[i]);
        i += 1;
      }
      if (!closed) {
        parts.push({
          kind: "dashboard_block",
          block: blockNum,
          yaml: yamlLines.join("\n"),
          fenceError: "Unclosed ```dashboard fence",
          startLine,
          endLine: lines.length,
          yamlStartLine,
          yamlEndLine: lines.length,
        });
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
