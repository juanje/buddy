// backends/wiki-check.ts — FR-WIKI-05: wiki health check and repair.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { WIKI_DIR } from "../shared/brain-paths";
import { buddyPath } from "./brain-paths";
import { regenerateWikiIndex } from "./wiki-index";
import {
  addBacklink,
  appendWikiLog,
  readWikiPage,
  resolveWikiLinkTarget,
  wikiLinkBetween,
} from "./wiki-reconcile";
import {
  contentLineCount,
  extractConnections,
  parseWikiFrontmatter,
  replaceConnectionsSection,
  slugifyTitle,
  type WikiConnection,
  type WikiLanguage,
} from "./wiki-format";
import { listWikiPageRelPaths } from "./wiki-index";

/** Pages with fewer content lines are flagged as thin (excluding frontmatter and connections). */
export const WIKI_THIN_PAGE_MIN_LINES = 5;

export interface WikiBrokenLink {
  fromPage: string;
  href: string;
  description: string;
}

export interface WikiMissingBacklink {
  fromPage: string;
  toPage: string;
  description: string;
}

export interface WikiFrontmatterIssue {
  page: string;
  problem: string;
}

export interface WikiUnresolvedSource {
  page: string;
  source: string;
}

export interface WikiHealthStats {
  totalPages: number;
  totalConnections: number;
  bidirectionalPct: number;
  categories: number;
}

export interface WikiHealthReport {
  orphans: string[];
  ghosts: string[];
  brokenLinks: WikiBrokenLink[];
  missingBacklinks: WikiMissingBacklink[];
  frontmatterIssues: WikiFrontmatterIssue[];
  unresolvedSources: WikiUnresolvedSource[];
  thinPages: string[];
  stats: WikiHealthStats;
}

export interface WikiRepairResult {
  backlinksAdded: number;
  brokenLinksFixed: number;
  indexRegenerated: boolean;
  repaired: number;
}

const INDEX_LINK_RE = /^\s*-\s*\[[^\]]+\]\(([^)]+)\)/gm;

function parseIndexPagePaths(indexContent: string): string[] {
  const paths: string[] = [];
  for (const match of indexContent.matchAll(INDEX_LINK_RE)) {
    paths.push(match[1].trim());
  }
  return paths;
}

function loadPageInventory(rootDir: string): Map<string, string> {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  const inventory = new Map<string, string>();
  for (const relPath of listWikiPageRelPaths(wikiDir)) {
    const content = readFileSync(join(wikiDir, relPath), "utf8");
    inventory.set(relPath, content);
  }
  return inventory;
}

function slugFromHref(href: string): string {
  const pathPart = href.split("#")[0]?.split("?")[0] ?? "";
  const base = basename(pathPart).replace(/\.md$/i, "");
  return slugifyTitle(base);
}

function findPageBySlug(pages: string[], slug: string): string | null {
  const normalized = slugifyTitle(slug);
  for (const relPath of pages) {
    const fileSlug = slugifyTitle(basename(relPath, ".md"));
    if (fileSlug === normalized) return relPath;
  }
  return null;
}

function hasReverseLink(
  rootDir: string,
  targetWikiRel: string,
  sourceWikiRel: string,
  targetContent: string,
): boolean {
  const connections = extractConnections(targetContent);
  return connections.some((conn) => resolveWikiLinkTarget(rootDir, targetWikiRel, conn.path) === sourceWikiRel);
}

export function wikiCheck(rootDir: string): WikiHealthReport {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (!existsSync(wikiDir)) {
    return emptyReport();
  }

  const inventory = loadPageInventory(rootDir);
  const pagePaths = [...inventory.keys()];

  const indexPath = buddyPath(rootDir, `${WIKI_DIR}/index.md`);
  const indexPaths = existsSync(indexPath)
    ? parseIndexPagePaths(readFileSync(indexPath, "utf8"))
    : [];

  const indexSet = new Set(indexPaths);
  const pageSet = new Set(pagePaths);

  const orphans = pagePaths.filter((p) => !indexSet.has(p));
  const ghosts = indexPaths.filter((p) => !pageSet.has(p));

  const brokenLinks: WikiBrokenLink[] = [];
  const missingBacklinks: WikiMissingBacklink[] = [];
  const frontmatterIssues: WikiFrontmatterIssue[] = [];
  const unresolvedSources: WikiUnresolvedSource[] = [];
  const thinPages: string[] = [];

  let totalConnections = 0;
  let bidirectional = 0;
  const categories = new Set<string>();

  for (const [relPath, content] of inventory) {
    if (relPath.includes("/")) categories.add(relPath.split("/")[0]);

    const fm = parseWikiFrontmatter(content);
    if (!fm.summary.trim()) {
      frontmatterIssues.push({ page: relPath, problem: "missing summary" });
    }
    if (!fm.created.trim()) {
      frontmatterIssues.push({ page: relPath, problem: "missing created" });
    }
    if (!fm.updated.trim()) {
      frontmatterIssues.push({ page: relPath, problem: "missing updated" });
    }
    if (fm.tags.length === 0) {
      frontmatterIssues.push({ page: relPath, problem: "missing tags" });
    }

    for (const source of fm.sources) {
      const abs = buddyPath(rootDir, source);
      if (!existsSync(abs)) {
        unresolvedSources.push({ page: relPath, source });
      }
    }

    if (contentLineCount(content) < WIKI_THIN_PAGE_MIN_LINES) {
      thinPages.push(relPath);
    }

    const connections = extractConnections(content);
    totalConnections += connections.length;

    for (const conn of connections) {
      const target = resolveWikiLinkTarget(rootDir, relPath, conn.path);
      const targetContent = target ? inventory.get(target) : undefined;
      if (!target || !targetContent) {
        if (!/^https?:/i.test(conn.path.split("#")[0] ?? "")) {
          brokenLinks.push({
            fromPage: relPath,
            href: conn.path,
            description: conn.description,
          });
        }
        continue;
      }

      if (hasReverseLink(rootDir, target, relPath, targetContent)) {
        bidirectional++;
      } else {
        missingBacklinks.push({
          fromPage: relPath,
          toPage: target,
          description: conn.description,
        });
      }
    }
  }

  const bidirectionalPct =
    totalConnections === 0 ? 100 : Math.round((bidirectional / totalConnections) * 100);

  return {
    orphans,
    ghosts,
    brokenLinks,
    missingBacklinks,
    frontmatterIssues,
    unresolvedSources,
    thinPages,
    stats: {
      totalPages: pagePaths.length,
      totalConnections,
      bidirectionalPct,
      categories: categories.size,
    },
  };
}

function emptyReport(): WikiHealthReport {
  return {
    orphans: [],
    ghosts: [],
    brokenLinks: [],
    missingBacklinks: [],
    frontmatterIssues: [],
    unresolvedSources: [],
    thinPages: [],
    stats: { totalPages: 0, totalConnections: 0, bidirectionalPct: 100, categories: 0 },
  };
}

function rewritePageConnections(
  rootDir: string,
  pageRelPath: string,
  connections: WikiConnection[],
  language?: WikiLanguage,
): void {
  const content = readWikiPage(rootDir, pageRelPath);
  writeFileSync(
    join(buddyPath(rootDir, WIKI_DIR), pageRelPath),
    replaceConnectionsSection(content, connections, language),
    "utf8",
  );
}

function repairBrokenLinks(
  rootDir: string,
  report: WikiHealthReport,
  pagePaths: string[],
  language?: WikiLanguage,
): number {
  let fixed = 0;
  const byPage = new Map<string, WikiBrokenLink[]>();
  for (const item of report.brokenLinks) {
    const list = byPage.get(item.fromPage) ?? [];
    list.push(item);
    byPage.set(item.fromPage, list);
  }

  for (const [fromPage, broken] of byPage) {
    const content = readWikiPage(rootDir, fromPage);
    const connections = extractConnections(content);
    let changed = false;

    for (const item of broken) {
      const slug = slugFromHref(item.href);
      const match = findPageBySlug(pagePaths, slug);
      if (!match) continue;

      const newPath = wikiLinkBetween(fromPage, match);
      const idx = connections.findIndex((c) => c.path === item.href);
      if (idx === -1) continue;
      connections[idx] = { path: newPath, description: item.description };
      changed = true;
      fixed++;
    }

    if (changed) {
      rewritePageConnections(rootDir, fromPage, connections, language);
    }
  }

  return fixed;
}

export function wikiRepairLinks(
  rootDir: string,
  report: WikiHealthReport,
  language?: WikiLanguage,
  now: Date = new Date(),
): WikiRepairResult {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (!existsSync(wikiDir)) {
    return { backlinksAdded: 0, brokenLinksFixed: 0, indexRegenerated: false, repaired: 0 };
  }

  const pagePaths = listWikiPageRelPaths(wikiDir);
  let backlinksAdded = 0;
  let brokenLinksFixed = 0;
  let indexRegenerated = false;

  for (const item of report.missingBacklinks) {
    if (addBacklink(rootDir, item.toPage, item.fromPage, item.description, language)) {
      backlinksAdded++;
    }
  }

  brokenLinksFixed = repairBrokenLinks(rootDir, report, pagePaths, language);

  if (report.orphans.length > 0 || report.ghosts.length > 0) {
    regenerateWikiIndex(rootDir, now, language);
    indexRegenerated = true;
  }

  const repaired = backlinksAdded + brokenLinksFixed + (indexRegenerated ? 1 : 0);
  return { backlinksAdded, brokenLinksFixed, indexRegenerated, repaired };
}

/** Post-write health pass: check, repair, log remaining warnings (FR-WIKI-05). */
export function runPostWriteWikiHealth(
  rootDir: string,
  language?: WikiLanguage,
  now: Date = new Date(),
): WikiRepairResult {
  const health = wikiCheck(rootDir);
  const repairs = wikiRepairLinks(rootDir, health, language, now);

  const remaining = wikiCheck(rootDir);
  const warnings: string[] = [];
  if (remaining.thinPages.length > 0) {
    warnings.push(`thin pages: ${remaining.thinPages.join(", ")}`);
  }
  if (remaining.unresolvedSources.length > 0) {
    warnings.push(`unresolved sources on ${remaining.unresolvedSources.length} page(s)`);
  }
  if (remaining.frontmatterIssues.length > 0) {
    warnings.push(`frontmatter issues on ${remaining.frontmatterIssues.length} page(s)`);
  }
  if (remaining.brokenLinks.length > 0) {
    warnings.push(`unresolved broken links on ${remaining.brokenLinks.length} page(s)`);
  }

  if (warnings.length > 0) {
    appendWikiLog(rootDir, `- **health warnings:** ${warnings.join("; ")}`, now);
  }

  return repairs;
}
