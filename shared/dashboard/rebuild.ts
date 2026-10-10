// shared/dashboard/rebuild.ts — Preserve free text when editing widgets (FR-DASH-12).

import { stringify } from "yaml";

import { splitFrontmatter } from "../frontmatter";
import { parseDashboardParts, type ParsedDashboardPart } from "./parse";
import { parseDashboardYamlBlock } from "./yaml-blocks";

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
  const block = `---\n${lines.join("\n")}\n---`;
  return block + content.slice(match[0].length);
}

export function formatDashboardBody(parts: ParsedDashboardPart[]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (part.kind === "text") {
      chunks.push(part.markdown);
      continue;
    }
    if (part.fenceError) {
      chunks.push("```dashboard", part.yaml, "```");
      continue;
    }
    const parsed = parseDashboardYamlBlock(part.yaml);
    const yamlBody = parsed.ok ? stringify(parsed.items).trim() : part.yaml;
    chunks.push("```dashboard", yamlBody, "```");
  }
  return chunks.join("\n\n");
}

export function replaceWidgetByTitle(
  content: string,
  widgetTitle: string,
  replacement: Record<string, unknown>,
): { ok: true; content: string } | { ok: false; message: string } {
  const { fields, body } = splitFrontmatter(content);
  const parts = parseDashboardParts(body);
  let matches = 0;
  let replaced = false;

  for (const part of parts) {
    if (part.kind !== "dashboard_block" || part.fenceError) continue;
    const parsed = parseDashboardYamlBlock(part.yaml);
    if (!parsed.ok) continue;
    const nextItems = parsed.items.map((item) => {
      const title = typeof item.title === "string" ? item.title : undefined;
      if (title === widgetTitle) {
        matches += 1;
        replaced = true;
        return replacement;
      }
      return item;
    });
    if (replaced) {
      part.yaml = stringify(nextItems).trim();
    }
  }

  if (matches === 0) {
    return { ok: false, message: `No widget with title '${widgetTitle}'` };
  }
  if (matches > 1) {
    return { ok: false, message: `Multiple widgets titled '${widgetTitle}' — titles must be unique for update` };
  }

  const newBody = formatDashboardBody(parts);
  const front =
    Object.keys(fields).length > 0
      ? `---\n${Object.entries(fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}\n---\n\n`
      : "";
  return { ok: true, content: front + newBody };
}
