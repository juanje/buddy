// shared/dashboard/rebuild.ts — Preserve free text when editing widgets (FR-DASH-12).

import { stringify } from "yaml";

import { parseDashboardParts } from "./parse";
import { parseDashboardYamlBlock } from "./yaml-blocks";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(\r?\n)?/;

/**
 * Set one frontmatter key, touching only that line. The body and every other
 * line stay byte-for-byte; a file without frontmatter gets a minimal block.
 */
export function setFrontmatterField(content: string, key: string, value: string): string {
  const line = `${key}: ${value}`;
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return `---\n${line}\n---\n\n${content}`;
  const lines = match[1].split(/\r?\n/);
  const idx = lines.findIndex((l) => l.slice(0, l.indexOf(":")).trim() === key);
  if (idx >= 0) lines[idx] = line;
  else lines.push(line);
  return `---\n${lines.join("\n")}\n---` + content.slice(match[0].length);
}

function bodySlice(content: string): { prefix: string; body: string } {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return { prefix: "", body: content };
  return { prefix: content.slice(0, match[0].length), body: content.slice(match[0].length) };
}

function replaceYamlInBody(body: string, yamlStartLine: number, yamlEndLine: number, newYaml: string): string {
  const lines = body.split(/\r?\n/);
  const yamlLines = newYaml.length > 0 ? newYaml.split(/\r?\n/) : [];
  const before = lines.slice(0, yamlStartLine - 1);
  const after = lines.slice(yamlEndLine);
  return [...before, ...yamlLines, ...after].join("\n");
}

export function replaceWidgetByTitle(
  content: string,
  widgetTitle: string,
  replacement: Record<string, unknown>,
): { ok: true; content: string } | { ok: false; message: string } {
  const { prefix, body } = bodySlice(content);
  const parts = parseDashboardParts(body);
  let matches = 0;
  let targetPart: Extract<(typeof parts)[number], { kind: "dashboard_block" }> | undefined;

  for (const part of parts) {
    if (part.kind !== "dashboard_block" || part.fenceError) continue;
    const parsed = parseDashboardYamlBlock(part.yaml);
    if (!parsed.ok) continue;
    for (const item of parsed.items) {
      const title = typeof item.title === "string" ? item.title : undefined;
      if (title === widgetTitle) {
        matches += 1;
        targetPart = part;
      }
    }
  }

  if (matches === 0) {
    return { ok: false, message: `No widget with title '${widgetTitle}'` };
  }
  if (matches > 1) {
    return { ok: false, message: `Multiple widgets titled '${widgetTitle}' — titles must be unique for update` };
  }

  const part = targetPart!;
  const parsed = parseDashboardYamlBlock(part.yaml);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }
  const nextItems = parsed.items.map((item) => {
    const title = typeof item.title === "string" ? item.title : undefined;
    return title === widgetTitle ? replacement : item;
  });
  const newYaml = stringify(nextItems).trim();
  const newBody = replaceYamlInBody(body, part.yamlStartLine, part.yamlEndLine, newYaml);
  return { ok: true, content: prefix + newBody };
}
