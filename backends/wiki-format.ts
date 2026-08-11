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

export type WikiLanguage = "en" | "es";

export interface WikiSectionHeadings {
  keyPoints: string;
  examples: string;
  connections: string;
}

/** Localized H2 labels for wiki pages (backend page format, not UI i18n). */
export const WIKI_SECTION_HEADINGS: Record<WikiLanguage, WikiSectionHeadings> = {
  en: { keyPoints: "Key points", examples: "Examples", connections: "Connections" },
  es: { keyPoints: "Puntos clave", examples: "Ejemplos", connections: "Conexiones" },
};

export function resolveWikiLanguage(language?: string): WikiLanguage {
  return language === "es" ? "es" : "en";
}

export function wikiSectionHeadings(language?: string): WikiSectionHeadings {
  return WIKI_SECTION_HEADINGS[resolveWikiLanguage(language)];
}

export interface WikiConnection {
  path: string;
  description: string;
  /** Visible link text; preserved on read/write round-trips when set. */
  label?: string;
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

interface H2Section {
  heading: string;
  lines: string[];
}

const H1_RE = /^#\s+(.+)$/m;
const H2_LINE_RE = /^##\s+(.+)$/;
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

function parseH2Sections(body: string): H2Section[] {
  const sections: H2Section[] = [];
  let current: H2Section | null = null;

  for (const line of body.split("\n")) {
    const match = line.match(H2_LINE_RE);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function sectionBullets(section: H2Section | undefined): string[] {
  if (!section) return [];
  return section.lines
    .map((line) => line.match(/^\s*-\s+(.*)/)?.[1])
    .filter((line): line is string => Boolean(line));
}

function isConnectionsSection(section: H2Section): boolean {
  return section.lines.some((line) => CONNECTION_LINK_RE.test(line));
}

function connectionsFromSection(section: H2Section): WikiConnection[] {
  const connections: WikiConnection[] = [];
  for (const line of section.lines) {
    const match = line.match(CONNECTION_LINK_RE);
    if (!match) continue;
    connections.push({
      path: match[2].trim(),
      description: match[3]?.trim() ?? "",
      label: match[1].trim() || undefined,
    });
  }
  return connections;
}

function findConnectionsSectionIndex(sections: H2Section[]): number {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (isConnectionsSection(sections[i])) return i;
  }
  return -1;
}

/** Split page body into intro and positional sections (H2 order, language-agnostic). */
export function splitWikiBody(body: string): {
  intro: string | undefined;
  keyPoints: string[];
  examples: string[];
  connections: WikiConnection[];
} {
  const afterH1 = body.replace(/^#\s+.+\n+/, "");
  const firstH2 = afterH1.search(/^##\s+/m);
  const intro =
    (firstH2 === -1 ? afterH1 : afterH1.slice(0, firstH2)).trim() || undefined;
  const h2Body = firstH2 === -1 ? "" : afterH1.slice(firstH2);
  const sections = parseH2Sections(h2Body);
  const connIdx = findConnectionsSectionIndex(sections);

  let keyPoints: string[] = [];
  let examples: string[] = [];
  let connections: WikiConnection[] = [];

  if (sections.length === 0) {
    return { intro, keyPoints, examples, connections };
  }

  if (connIdx === -1) {
    keyPoints = sectionBullets(sections[0]);
    examples = sections.length > 1 ? sectionBullets(sections[1]) : [];
  } else if (connIdx === 0) {
    connections = connectionsFromSection(sections[0]);
  } else if (connIdx === 1) {
    keyPoints = sectionBullets(sections[0]);
    connections = connectionsFromSection(sections[1]);
  } else {
    keyPoints = sectionBullets(sections[0]);
    examples = sectionBullets(sections[1]);
    connections = connectionsFromSection(sections[connIdx]);
  }

  return { intro, keyPoints, examples, connections };
}

/** Lines excluding frontmatter and the connections section (positional). */
export function contentLineCount(content: string): number {
  const { body } = splitFrontmatter(content);
  const afterH1 = body.replace(/^#\s+.+\n+/, "");
  const firstH2 = afterH1.search(/^##\s+/m);
  const intro = (firstH2 === -1 ? afterH1 : afterH1.slice(0, firstH2)).trim();
  const h2Body = firstH2 === -1 ? "" : afterH1.slice(firstH2);
  const sections = parseH2Sections(h2Body);
  const connIdx = findConnectionsSectionIndex(sections);

  const lines: string[] = [];
  if (intro) lines.push(...intro.split("\n").filter((line) => line.trim()));

  const contentSections = connIdx === -1 ? sections : sections.slice(0, connIdx);
  for (const section of contentSections) {
    lines.push(`## ${section.heading}`);
    lines.push(...section.lines.filter((line) => line.trim()));
  }

  return lines.filter((line) => line.trim()).length;
}

export function extractConnections(content: string): WikiConnection[] {
  const { body } = splitFrontmatter(content);
  return splitWikiBody(body).connections;
}

function connectionLinkLabel(conn: WikiConnection): string {
  return conn.label ?? conn.path.split("/").pop()?.replace(/\.md$/, "") ?? "related";
}

function formatFrontmatterList(key: string, items: string[]): string[] {
  if (items.length === 0) return [`${key}: []`];
  if (items.length <= 3 && items.every((item) => !item.includes(","))) {
    return [`${key}: [${items.join(", ")}]`];
  }
  return [key + ":", ...items.map((item) => `  - ${item}`)];
}

export function formatWikiPage(data: WikiPageInput, language?: string): string {
  const tagError = validateWikiTags(data.tags);
  if (tagError) throw new Error(tagError);
  const summaryError = validateWikiSummary(data.summary);
  if (summaryError) throw new Error(summaryError);

  const headings = wikiSectionHeadings(language);
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
    lines.push(`## ${headings.keyPoints}`);
    for (const point of data.keyPoints) {
      lines.push(`- ${point}`);
    }
    lines.push("");
  }

  if (data.examples && data.examples.length > 0) {
    lines.push(`## ${headings.examples}`);
    for (const example of data.examples) {
      lines.push(`- ${example}`);
    }
    lines.push("");
  }

  if (data.connections && data.connections.length > 0) {
    lines.push(`## ${headings.connections}`);
    for (const conn of data.connections) {
      const label = connectionLinkLabel(conn);
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

/**
 * Render a connections section as markdown lines (no trailing newline).
 * Used by surgical page editors that replace only the connections section.
 */
export function renderConnectionsLines(
  connections: WikiConnection[],
  language?: string,
): string[] {
  const headings = wikiSectionHeadings(language);
  const lines = [`## ${headings.connections}`];
  for (const conn of connections) {
    const label = connectionLinkLabel(conn);
    const desc = conn.description ? ` — ${conn.description}` : "";
    lines.push(`- [${label}](${conn.path})${desc}`);
  }
  return lines;
}

/**
 * Replace (or append) the connections section in raw page content without
 * touching any other section. Preserves frontmatter, intro, and all H2
 * sections that are not the connections section.
 */
export function replaceConnectionsSection(
  content: string,
  connections: WikiConnection[],
  language?: string,
): string {
  const { body } = splitFrontmatter(content);
  const h2Body = body.replace(/^#\s+.+\n+/, "");
  const sections = parseH2Sections(h2Body);
  const connIdx = findConnectionsSectionIndex(sections);

  if (connIdx === -1 && connections.length === 0) return content;

  const lines = content.split("\n");

  if (connIdx !== -1) {
    const section = sections[connIdx];
    const headingRe = new RegExp(`^##\\s+${escapeRegex(section.heading)}\\s*$`);
    const startLine = lines.findIndex((line) => headingRe.test(line));
    if (startLine !== -1) {
      let endLine = startLine + 1;
      while (endLine < lines.length && !H2_LINE_RE.test(lines[endLine])) {
        endLine++;
      }
      if (endLine === lines.length) {
        endLine = startLine + 1;
        while (
          endLine < lines.length &&
          (CONNECTION_LINK_RE.test(lines[endLine]) || lines[endLine].trim() === "")
        ) {
          endLine++;
        }
      } else {
        while (endLine > startLine + 1 && lines[endLine - 1].trim() === "") {
          endLine--;
        }
      }
      const newLines = connections.length > 0
        ? [...renderConnectionsLines(connections, language), ""]
        : [];
      lines.splice(startLine, endLine - startLine, ...newLines);
      const result = lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "") + "\n";
      return result;
    }
  }

  if (connections.length > 0) {
    const trimmed = content.replace(/\n+$/, "");
    return trimmed + "\n\n" + renderConnectionsLines(connections, language).join("\n") + "\n";
  }

  return content;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
