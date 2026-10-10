// shared/dashboard/rebuild.ts — Preserve free text when editing widgets (FR-DASH-12).

import { stringify } from "yaml";

import { splitFrontmatter } from "../frontmatter";
import { parseDashboardParts, type ParsedDashboardPart } from "./parse";
import { parseDashboardYamlBlock } from "./yaml-blocks";

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
