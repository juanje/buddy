// backends/wiki-synthesis.ts — FR-WIKI-06 wiki synthesis candidates and runner.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { WIKI_DIR } from "../shared/brain-paths";
import { buddyPath } from "./brain-paths";
import {
  extractConnections,
  readWikiPageMetadata,
  slugifyTitle,
  type WikiPageMetadata,
} from "./wiki-format";
import { listWikiPageRelPaths } from "./wiki-index";
import { resolveWikiLinkTarget } from "./wiki-reconcile";

export type SynthesisCandidateType = "orphan-tag" | "co-occurrence" | "disconnected-cluster";

export interface SynthesisCandidate {
  type: SynthesisCandidateType;
  label: string;
  score: number;
  relatedPages: string[];
  rationale: string;
}

/** Minimum pages carrying a tag before it qualifies as orphan-dense. */
export const WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES = 3;

/** Minimum pages sharing a tag pair before co-occurrence qualifies. */
export const WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES = 3;

/** Minimum shared tags for disconnected-cluster detection. */
export const WIKI_SYNTHESIS_DISCONNECTED_MIN_SHARED_TAGS = 2;

export const WIKI_SYNTHESIS_MAX_PAGES_PER_RUN = 3;
export const WIKI_SYNTHESIS_PAGE_GROWTH_THRESHOLD = 10;

function loadAllPageMetadata(rootDir: string): WikiPageMetadata[] {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (!existsSync(wikiDir)) return [];
  return listWikiPageRelPaths(wikiDir).map((relPath) => {
    const content = readFileSync(join(wikiDir, relPath), "utf8");
    return readWikiPageMetadata(relPath, content);
  });
}

function tagHasMatchingPage(pages: WikiPageMetadata[], tag: string): boolean {
  const tagSlug = slugifyTitle(tag);
  return pages.some(
    (page) =>
      slugifyTitle(page.title) === tagSlug ||
      slugifyTitle(page.relPath.replace(/\.md$/i, "").split("/").pop() ?? "") === tagSlug,
  );
}

function detectOrphanTags(pages: WikiPageMetadata[]): SynthesisCandidate[] {
  const tagToPages = new Map<string, string[]>();
  for (const page of pages) {
    for (const tag of page.tags) {
      const list = tagToPages.get(tag) ?? [];
      list.push(page.relPath);
      tagToPages.set(tag, list);
    }
  }

  const candidates: SynthesisCandidate[] = [];
  for (const [tag, relPaths] of tagToPages) {
    if (relPaths.length < WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES) continue;
    if (tagHasMatchingPage(pages, tag)) continue;
    candidates.push({
      type: "orphan-tag",
      label: tag,
      score: relPaths.length,
      relatedPages: [...relPaths].sort(),
      rationale: `Tag "${tag}" appears on ${relPaths.length} pages but no page title matches it.`,
    });
  }
  return candidates;
}

function detectCoOccurrence(pages: WikiPageMetadata[]): SynthesisCandidate[] {
  const pairCounts = new Map<string, { count: number; pages: Set<string> }>();

  for (const page of pages) {
    const tags = [...new Set(page.tags)].sort();
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = `${tags[i]} + ${tags[j]}`;
        const entry = pairCounts.get(key) ?? { count: 0, pages: new Set<string>() };
        entry.count++;
        entry.pages.add(page.relPath);
        pairCounts.set(key, entry);
      }
    }
  }

  const candidates: SynthesisCandidate[] = [];
  for (const [label, { count, pages: pageSet }] of pairCounts) {
    if (count < WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES) continue;
    candidates.push({
      type: "co-occurrence",
      label,
      score: count,
      relatedPages: [...pageSet].sort(),
      rationale: `Tags ${label} co-occur on ${count} pages.`,
    });
  }
  return candidates;
}

function pagesAreConnected(rootDir: string, pageA: WikiPageMetadata, pageB: WikiPageMetadata): boolean {
  const aTargets = pageA.connections
    .map((c) => resolveWikiLinkTarget(rootDir, pageA.relPath, c.path))
    .filter((t): t is string => t !== null);
  if (aTargets.includes(pageB.relPath)) return true;

  const bTargets = pageB.connections
    .map((c) => resolveWikiLinkTarget(rootDir, pageB.relPath, c.path))
    .filter((t): t is string => t !== null);
  return bTargets.includes(pageA.relPath);
}

function sharedTagCount(a: WikiPageMetadata, b: WikiPageMetadata): number {
  const bTags = new Set(b.tags);
  return a.tags.filter((tag) => bTags.has(tag)).length;
}

function detectDisconnectedClusters(rootDir: string, pages: WikiPageMetadata[]): SynthesisCandidate[] {
  const candidates: SynthesisCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const pageA = pages[i];
      const pageB = pages[j];
      const shared = sharedTagCount(pageA, pageB);
      if (shared < WIKI_SYNTHESIS_DISCONNECTED_MIN_SHARED_TAGS) continue;
      if (pagesAreConnected(rootDir, pageA, pageB)) continue;

      const key = [pageA.relPath, pageB.relPath].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const sharedTags = pageA.tags.filter((tag) => pageB.tags.includes(tag)).sort();
      candidates.push({
        type: "disconnected-cluster",
        label: `${pageA.title} ↔ ${pageB.title}`,
        score: shared,
        relatedPages: [pageA.relPath, pageB.relPath].sort(),
        rationale: `Pages share tags (${sharedTags.join(", ")}) but are not linked.`,
      });
    }
  }
  return candidates;
}

/** L1 heuristic scan — deterministic, no LLM (FR-WIKI-06). */
export function wikiSynthesisCandidates(rootDir: string): SynthesisCandidate[] {
  const pages = loadAllPageMetadata(rootDir);
  if (pages.length === 0) return [];

  const candidates = [
    ...detectOrphanTags(pages),
    ...detectCoOccurrence(pages),
    ...detectDisconnectedClusters(rootDir, pages),
  ];

  return candidates.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

/** Re-export for tests that build pages with connections from raw content. */
export { extractConnections };
