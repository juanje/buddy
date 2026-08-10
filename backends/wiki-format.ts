// backends/wiki-format.ts — Wiki page format utilities (FR-WIKI-01, D7).

import { splitFrontmatter } from "../shared/frontmatter";

/** Maximum length for a one-line summary in frontmatter. */
export const WIKI_SUMMARY_MAX_LEN = 200;

/** Tags must be lowercase slugs: `complex-systems`, not `Complex Systems`. */
export const WIKI_TAG_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Enrichment aborts when content exceeds this many lines (excluding frontmatter and Connections). */
export const WIKI_CONTENT_LINE_GUARD = 80;

/** Root-level wiki files that are not concept pages. */
export const WIKI_META_FILES = new Set(["index.md", "tags.md", "glossary.md"]);

export interface WikiConnection {
  path: string;
  description: string;
}

export interface WikiFrontmatter {
  tags: string[];
  sources: string[];
  created: string;
  updated: string;
  summary: string;
}

export interface WikiPageInput {
  title: string;
  summary: string;
  tags: string[];
  sources?: string[];
  created: string;
  updated: string;
  intro?: string;
  keyPoints?: string[];
  examples?: string[];
  connections?: WikiConnection[];
}

export interface WikiPageMetadata {
  relPath: string;
  title: string;
  summary: string;
  tags: string[];
  category: string;
  connections: WikiConnection[];
}

const H1_RE = /^#\s+(.+)$/m;
const CONNECTIONS_HEADING = /^##\s+Connections\s*$/m;
const CONNECTION_LINK_RE = /^\s*-\s*\[([^\]]*)\]\(([^)]+\.md)\)\s*(?:—|--|-)?\s*(.*)$/;

/** Strip accents and collapse whitespace for title matching (D13). */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Slug for filenames and category directories. */
export function slugifyTitle(title: string): string {
  return normalizeTitle(title).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function extractTitle(content: string): string {
  const { body } = splitFrontmatter(content);
  const match = body.match(H1_RE);
  return match?.[1]?.trim() ?? "";
}

function parseInlineList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMultilineList(lines: string[], startIndex: number): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith("  - ")) break;
    items.push(line.slice(4).trim());
    i++;
  }
  return { items, nextIndex: i };
}

/** Parse wiki frontmatter fields, including list-valued tags and sources. */
export function parseWikiFrontmatter(content: string): WikiFrontmatter {
  const { fields } = splitFrontmatter(content);
  const rawLines = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]?.split("\n") ?? [];

  let tags = parseInlineList(fields.tags ?? "");
  let sources = parseInlineList(fields.sources ?? "");

  if (tags.length === 0 && fields.tags === "") {
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].trim() === "tags:") {
        ({ items: tags } = parseMultilineList(rawLines, i + 1));
        break;
      }
    }
  }
  if (sources.length === 0 && !fields.sources?.startsWith("[")) {
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].trim() === "sources:") {
        ({ items: sources } = parseMultilineList(rawLines, i + 1));
        break;
      }
    }
  }

  return {
    tags,
    sources,
    created: fields.created ?? "",
    updated: fields.updated ?? "",
    summary: fields.summary ?? "",
  };
}

export function validateWikiTags(tags: string[]): string | null {
  for (const tag of tags) {
    if (!WIKI_TAG_SLUG_RE.test(tag)) {
      return `Invalid tag "${tag}": use lowercase slugs (a-z, 0-9, hyphens).`;
    }
  }
  return null;
}

export function validateWikiSummary(summary: string): string | null {
  if (summary.includes("\n")) return "Summary must be a single line.";
  if (summary.length > WIKI_SUMMARY_MAX_LEN) {
    return `Summary exceeds ${WIKI_SUMMARY_MAX_LEN} characters.`;
  }
  return null;
}

export function contentLineCount(content: string): number {
  const { body } = splitFrontmatter(content);
  const connectionsIdx = body.search(CONNECTIONS_HEADING);
  const countable = connectionsIdx === -1 ? body : body.slice(0, connectionsIdx);
  return countable.split("\n").filter((line) => line.trim().length > 0).length;
}

export function extractConnections(content: string): WikiConnection[] {
  const { body } = splitFrontmatter(content);
  const connectionsMatch = body.match(CONNECTIONS_HEADING);
  if (!connectionsMatch || connectionsMatch.index === undefined) return [];

  const section = body.slice(connectionsMatch.index + connectionsMatch[0].length);
  const connections: WikiConnection[] = [];
  for (const line of section.split("\n")) {
    const match = line.match(CONNECTION_LINK_RE);
    if (!match) continue;
    connections.push({
      path: match[2].trim(),
      description: match[3]?.trim() || match[1]?.trim() || "",
    });
  }
  return connections;
}

function formatFrontmatterList(key: string, items: string[]): string[] {
  if (items.length === 0) return [`${key}: []`];
  if (items.length <= 3 && items.every((item) => !item.includes(","))) {
    return [`${key}: [${items.join(", ")}]`];
  }
  return [key + ":", ...items.map((item) => `  - ${item}`)];
}

export function formatWikiPage(data: WikiPageInput): string {
  const tagError = validateWikiTags(data.tags);
  if (tagError) throw new Error(tagError);
  const summaryError = validateWikiSummary(data.summary);
  if (summaryError) throw new Error(summaryError);

  const lines: string[] = ["---"];
  lines.push(...formatFrontmatterList("tags", data.tags));
  lines.push(...formatFrontmatterList("sources", data.sources ?? []));
  lines.push(`created: ${data.created}`);
  lines.push(`updated: ${data.updated}`);
  lines.push(`summary: ${data.summary}`);
  lines.push("---", "", `# ${data.title}`, "");

  if (data.intro?.trim()) {
    lines.push(data.intro.trim(), "");
  }

  if (data.keyPoints && data.keyPoints.length > 0) {
    lines.push("## Key points");
    for (const point of data.keyPoints) {
      lines.push(`- ${point}`);
    }
    lines.push("");
  }

  if (data.examples && data.examples.length > 0) {
    lines.push("## Examples");
    for (const example of data.examples) {
      lines.push(`- ${example}`);
    }
    lines.push("");
  }

  if (data.connections && data.connections.length > 0) {
    lines.push("## Connections");
    for (const conn of data.connections) {
      const label = conn.path.split("/").pop()?.replace(/\.md$/, "") ?? "related";
      const desc = conn.description ? ` — ${conn.description}` : "";
      lines.push(`- [${label}](${conn.path})${desc}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export function wikiPageCategory(relPath: string): string {
  const parts = relPath.split("/");
  return parts.length > 1 ? parts[0] : "";
}

export function humanizeCategorySlug(slug: string): string {
  if (!slug) return "Uncategorized";
  const words = slug.split("-").filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function readWikiPageMetadata(relPath: string, content: string): WikiPageMetadata {
  const fm = parseWikiFrontmatter(content);
  return {
    relPath,
    title: extractTitle(content),
    summary: fm.summary,
    tags: fm.tags,
    category: wikiPageCategory(relPath),
    connections: extractConnections(content),
  };
}
