// backends/wiki-reconcile.ts — Wiki page reconciliation (FR-WIKI-02/03, D13).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { toIsoDay } from "../shared/dates";
import { WIKI_DIR } from "../shared/brain-paths";
import { splitFrontmatter } from "../shared/frontmatter";
import { buddyPath, wikiMetaLogPath } from "./brain-paths";
import { containedRelPath } from "./containment";
import {
  WIKI_CONTENT_LINE_GUARD,
  contentLineCount,
  extractTitle,
  formatWikiPage,
  normalizeTitle,
  parseWikiFrontmatter,
  slugifyTitle,
  splitWikiBody,
  type WikiConnection,
  type WikiLanguage,
  type WikiPageInput,
} from "./wiki-format";
import { listWikiPageRelPaths } from "./wiki-index";

export interface WikiMatch {
  relPath: string;
  matchType: "title" | "tags";
}

export interface WikiEnrichInput {
  keyPoints?: string[];
  examples?: string[];
  tags?: string[];
  sources?: string[];
  connections?: WikiConnection[];
  updated: string;
}

function wikiRelPath(rootDir: string, absPath: string): string | null {
  const rel = containedRelPath(rootDir, absPath);
  if (!rel?.startsWith(`${WIKI_DIR}/`)) return null;
  return rel.slice(`${WIKI_DIR}/`.length);
}

export function resolveWikiPagePath(
  rootDir: string,
  category: string,
  title: string,
): { absPath: string; wikiRelPath: string; buddyRelPath: string } {
  const categorySlug = slugifyTitle(category);
  const pageSlug = slugifyTitle(title);
  if (!categorySlug || !pageSlug) {
    throw new Error("Category and title must produce valid path segments.");
  }
  const buddyRelPath = `${WIKI_DIR}/${categorySlug}/${pageSlug}.md`;
  const absPath = buddyPath(rootDir, buddyRelPath);
  const contained = containedRelPath(rootDir, absPath);
  if (contained !== buddyRelPath) {
    throw new Error("Resolved wiki path escapes the workspace.");
  }
  return { absPath, wikiRelPath: `${categorySlug}/${pageSlug}.md`, buddyRelPath };
}

export function resolveWikiLinkTarget(
  rootDir: string,
  fromWikiRel: string,
  href: string,
): string | null {
  const pathPart = href.split("#")[0]?.split("?")[0] ?? "";
  if (!pathPart || /^https?:/i.test(pathPart)) return null;

  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  const fromDir = dirname(join(wikiDir, fromWikiRel));
  const abs = join(fromDir, pathPart);
  return wikiRelPath(rootDir, abs);
}

function relativeWikiLink(fromWikiRel: string, toWikiRel: string): string {
  const fromDir = dirname(fromWikiRel);
  return relative(fromDir, toWikiRel).split(sep).join("/");
}

export function wikiLinkBetween(fromWikiRel: string, toWikiRel: string): string {
  return relativeWikiLink(fromWikiRel, toWikiRel);
}

export function findMatchingPage(rootDir: string, title: string, tags: string[]): WikiMatch | null {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (!existsSync(wikiDir)) return null;

  const normalized = normalizeTitle(title);
  let tagMatch: WikiMatch | null = null;

  for (const relPath of listWikiPageRelPaths(wikiDir)) {
    const content = readFileSync(join(wikiDir, relPath), "utf8");
    if (normalizeTitle(extractTitle(content)) === normalized) {
      return { relPath, matchType: "title" };
    }

    const fm = parseWikiFrontmatter(content);
    const overlap = fm.tags.filter((tag) => tags.includes(tag)).length;
    if (overlap >= 3 && !tagMatch) {
      tagMatch = { relPath, matchType: "tags" };
    }
  }

  return tagMatch;
}

function mergeFrontmatter(
  existing: ReturnType<typeof parseWikiFrontmatter>,
  input: WikiEnrichInput,
): { tags: string[]; sources: string[]; created: string; updated: string; summary: string } {
  const tags = [...new Set([...existing.tags, ...(input.tags ?? [])])];
  const sources = [...existing.sources];
  for (const source of input.sources ?? []) {
    if (!sources.includes(source)) sources.push(source);
  }
  return {
    tags,
    sources,
    created: existing.created,
    updated: input.updated,
    summary: existing.summary,
  };
}

function mergeConnections(existing: WikiConnection[], incoming: WikiConnection[]): WikiConnection[] {
  const byPath = new Map<string, WikiConnection>();
  for (const conn of existing) byPath.set(conn.path, conn);
  for (const conn of incoming) {
    if (!byPath.has(conn.path)) byPath.set(conn.path, conn);
  }
  return [...byPath.values()];
}

function buildPageFromParts(
  title: string,
  fm: { tags: string[]; sources: string[]; created: string; updated: string; summary: string },
  intro: string | undefined,
  keyPoints: string[],
  examples: string[],
  connections: WikiConnection[],
  language?: WikiLanguage,
): string {
  return formatWikiPage(
    {
      title,
      summary: fm.summary,
      tags: fm.tags,
      sources: fm.sources,
      created: fm.created,
      updated: fm.updated,
      intro,
      keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
      examples: examples.length > 0 ? examples : undefined,
      connections,
    },
    language,
  );
}

export function enrichPage(
  rootDir: string,
  pageRelPath: string,
  input: WikiEnrichInput,
  language?: WikiLanguage,
): { action: "enriched" | "too-large"; content?: string } {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  const absPath = join(wikiDir, pageRelPath);
  const existing = readFileSync(absPath, "utf8");
  const fm = parseWikiFrontmatter(existing);
  const { body } = splitFrontmatter(existing);
  const title = extractTitle(existing);
  const parsed = splitWikiBody(body);

  const keyPoints = [...parsed.keyPoints, ...(input.keyPoints ?? [])];
  const examples = [...parsed.examples, ...(input.examples ?? [])];
  const mergedFm = mergeFrontmatter(fm, input);
  const mergedConnections = mergeConnections(parsed.connections, input.connections ?? []);
  const candidate = buildPageFromParts(
    title,
    mergedFm,
    parsed.intro,
    keyPoints,
    examples,
    mergedConnections,
    language,
  );

  if (contentLineCount(candidate) > WIKI_CONTENT_LINE_GUARD) {
    return { action: "too-large" };
  }

  writeFileSync(absPath, candidate, "utf8");
  return { action: "enriched", content: candidate };
}

export function addBacklink(
  rootDir: string,
  targetWikiRel: string,
  sourceWikiRel: string,
  description: string,
  language?: WikiLanguage,
): boolean {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  const absPath = join(wikiDir, targetWikiRel);
  if (!existsSync(absPath)) return false;

  const content = readFileSync(absPath, "utf8");
  const fm = parseWikiFrontmatter(content);
  const title = extractTitle(content);
  const { body } = splitFrontmatter(content);
  const parsed = splitWikiBody(body);

  const linkPath = relativeWikiLink(targetWikiRel, sourceWikiRel);
  const alreadyLinked = parsed.connections.some(
    (conn) =>
      conn.path === linkPath ||
      resolveWikiLinkTarget(rootDir, targetWikiRel, conn.path) === sourceWikiRel,
  );
  if (alreadyLinked) return false;

  const updated = buildPageFromParts(
    title,
    { ...fm, tags: fm.tags, sources: fm.sources, created: fm.created, updated: fm.updated, summary: fm.summary },
    parsed.intro,
    parsed.keyPoints,
    parsed.examples,
    [...parsed.connections, { path: linkPath, description }],
    language,
  );
  writeFileSync(absPath, updated, "utf8");
  return true;
}

export function addBacklinks(
  rootDir: string,
  sourceWikiRel: string,
  connections: WikiConnection[],
  _sourceTitle: string,
  language?: WikiLanguage,
): number {
  let added = 0;
  for (const conn of connections) {
    const targetRel = resolveWikiLinkTarget(rootDir, sourceWikiRel, conn.path);
    if (!targetRel || targetRel === sourceWikiRel) continue;
    if (addBacklink(rootDir, targetRel, sourceWikiRel, conn.description, language)) {
      added++;
    }
  }
  return added;
}

export function createWikiPage(
  rootDir: string,
  input: WikiPageInput & { category: string },
  language?: WikiLanguage,
): string {
  const { absPath, wikiRelPath } = resolveWikiPagePath(rootDir, input.category, input.title);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, formatWikiPage(input, language), "utf8");
  return wikiRelPath;
}

export function appendWikiLog(rootDir: string, entry: string, now: Date = new Date()): void {
  const logPath = wikiMetaLogPath(rootDir);
  mkdirSync(dirname(logPath), { recursive: true });
  const day = toIsoDay(now);
  const line = `\n## ${day}\n\n${entry}\n`;
  if (existsSync(logPath)) {
    writeFileSync(logPath, readFileSync(logPath, "utf8") + line, "utf8");
  } else {
    writeFileSync(logPath, `# Wiki log${line}`, "utf8");
  }
}

export function readWikiPage(rootDir: string, wikiRelPath: string): string {
  return readFileSync(join(buddyPath(rootDir, WIKI_DIR), wikiRelPath), "utf8");
}
