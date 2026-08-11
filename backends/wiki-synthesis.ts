// backends/wiki-synthesis.ts — FR-WIKI-06 wiki synthesis candidates and runner.

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  defineTool,
  type ModelRuntime,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { EXCLUDED_TOOLS } from "../shared/defaults";
import { WIKI_DIR } from "../shared/brain-paths";
import { toIsoDay } from "../shared/dates";
import type { WikiMaintenanceState } from "../shared/wiki-state";
import { buddyPath } from "./brain-paths";
import { resolveFastTierModel } from "./fast-model";
import { commitAll } from "./git";
import { buddyAgentDir } from "./global-config";
import { buddySessionsDir } from "./session-paths";
import {
  buildWikiFileTool,
  type WikiFileInput,
} from "./wiki-file";
import { resolveInstanceLanguage } from "./wiki-tools";
import {
  extractConnections,
  readWikiPageMetadata,
  slugifyTitle,
  type WikiLanguage,
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

export interface WikiSynthesisResult {
  state: WikiMaintenanceState;
  ran: boolean;
  pagesCreated: number;
  candidates: SynthesisCandidate[];
}

export interface WikiSynthesisSessionLike {
  prompt(text: string): Promise<void>;
  dispose(): void;
  pagesCreated(): number;
  capRejected(): boolean;
}

export const SYNTHESIS_CAP_MESSAGE =
  "Synthesis cap reached (3 pages per run). Stop creating pages.";

function wikiPageCount(rootDir: string): number {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (!existsSync(wikiDir)) return 0;
  return listWikiPageRelPaths(wikiDir).length;
}

export function daysSinceIso(iso: string | null, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (now.getTime() - new Date(iso).getTime()) / (86400 * 1000);
}

export function shouldRunWikiSynthesis(
  state: WikiMaintenanceState,
  pageCount: number,
  now: Date,
): boolean {
  const growth = pageCount - state.pagesAtLastSynthesis;
  if (state.lastSynthesis !== null && growth < WIKI_SYNTHESIS_PAGE_GROWTH_THRESHOLD) {
    return false;
  }
  if (state.lastSynthesis !== null && daysSinceIso(state.lastSynthesis, now) < state.synthesisCooldownDays) {
    return false;
  }
  if (state.lastSynthesis === null && pageCount < WIKI_SYNTHESIS_PAGE_GROWTH_THRESHOLD) {
    return false;
  }
  return true;
}

export function buildSynthesisPrompt(candidates: SynthesisCandidate[]): string {
  return [
    "Evaluate these wiki synthesis candidates. Call wiki_file for each candidate that deserves its own page.",
    `Do not exceed ${WIKI_SYNTHESIS_MAX_PAGES_PER_RUN} pages in this run.`,
    "",
    "Candidates:",
    JSON.stringify(candidates, null, 2),
    "",
    'For each approved candidate, create a synthesis page with title from the label, a one-line summary, key points, tags, category, connections to related pages, and sources including "synthesis".',
  ].join("\n");
}

export function buildCappedWikiFileTools(
  rootDir: string,
  language: WikiLanguage | undefined,
  maxPages: number,
  counters: { created: number; rejected: boolean },
): ToolDefinition[] {
  const baseTools = buildWikiFileTool(rootDir, language);
  return baseTools.map((tool) =>
    defineTool({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      parameters: tool.parameters,
      async execute(callId, args, signal, onUpdate, ctx) {
        if (counters.created >= maxPages) {
          counters.rejected = true;
          return {
            content: [{ type: "text", text: SYNTHESIS_CAP_MESSAGE }],
            details: { capped: true },
          };
        }
        const input = {
          ...(args as WikiFileInput),
          sources: [...((args as WikiFileInput).sources ?? []), "synthesis"],
        };
        const result = await tool.execute(callId, input, signal, onUpdate, ctx);
        const details = result.details as { capped?: boolean } | undefined;
        if (!details?.capped) counters.created++;
        return result;
      },
    }),
  );
}

export type WikiSynthesisAgentSession = Pick<
  Awaited<ReturnType<typeof createAgentSession>>["session"],
  "prompt" | "dispose"
>;

async function openRealWikiSynthesisSession(config: {
  rootDir: string;
  modelRuntime: ModelRuntime;
  language?: WikiLanguage;
  counters: { created: number; rejected: boolean };
}): Promise<WikiSynthesisAgentSession> {
  const modelOptions = await resolveFastTierModel(config.rootDir, config.modelRuntime, "off");
  const resourceLoader = new DefaultResourceLoader({
    cwd: config.rootDir,
    agentDir: buddyAgentDir(),
    systemPromptOverride: () =>
      "You evaluate wiki synthesis candidates and file approved concepts using wiki_file only.",
  });
  await resourceLoader.reload();

  const cappedTools = buildCappedWikiFileTools(
    config.rootDir,
    config.language,
    WIKI_SYNTHESIS_MAX_PAGES_PER_RUN,
    config.counters,
  );

  const { session } = await createAgentSession({
    cwd: config.rootDir,
    agentDir: buddyAgentDir(),
    resourceLoader,
    sessionManager: SessionManager.create(config.rootDir, buddySessionsDir(config.rootDir)),
    excludeTools: [...EXCLUDED_TOOLS],
    tools: ["wiki_file"],
    customTools: cappedTools,
    modelRuntime: config.modelRuntime,
    ...modelOptions,
  });
  return session;
}

export async function createWikiSynthesisSession(options: {
  rootDir: string;
  modelRuntime: ModelRuntime;
  language?: WikiLanguage;
  openSession?: (config: {
    rootDir: string;
    modelRuntime: ModelRuntime;
    language?: WikiLanguage;
    counters: { created: number; rejected: boolean };
  }) => Promise<WikiSynthesisAgentSession>;
}): Promise<WikiSynthesisSessionLike> {
  const counters = { created: 0, rejected: false };
  const openSession = options.openSession ?? openRealWikiSynthesisSession;
  const session = await openSession({
    rootDir: options.rootDir,
    modelRuntime: options.modelRuntime,
    language: options.language,
    counters,
  });

  return {
    async prompt(text: string) {
      await session.prompt(text);
    },
    dispose() {
      session.dispose();
    },
    pagesCreated() {
      return counters.created;
    },
    capRejected() {
      return counters.rejected;
    },
  };
}

export async function runWikiSynthesis(
  rootDir: string,
  state: WikiMaintenanceState,
  modelRuntime: ModelRuntime,
  language?: WikiLanguage,
  now: Date = new Date(),
  deps: {
    createSession?: typeof createWikiSynthesisSession;
  } = {},
): Promise<WikiSynthesisResult> {
  const lang = language ?? resolveInstanceLanguage();
  const candidates = wikiSynthesisCandidates(rootDir);
  const pageCount = wikiPageCount(rootDir);

  if (candidates.length === 0) {
    return {
      state: { ...state, lastSynthesis: now.toISOString(), pagesAtLastSynthesis: pageCount },
      ran: false,
      pagesCreated: 0,
      candidates: [],
    };
  }

  const createSession = deps.createSession ?? createWikiSynthesisSession;
  let session: WikiSynthesisSessionLike | undefined;
  let pagesCreated = 0;

  try {
    session = await createSession({ rootDir, modelRuntime, language: lang });
    await session.prompt(buildSynthesisPrompt(candidates));
    pagesCreated = session.pagesCreated();
    if (pagesCreated > 0) {
      await commitAll(rootDir, `wiki: synthesis ${toIsoDay(now)}`);
    }
  } finally {
    session?.dispose();
  }

  return {
    state: {
      ...state,
      lastSynthesis: now.toISOString(),
      pagesAtLastSynthesis: wikiPageCount(rootDir),
    },
    ran: true,
    pagesCreated,
    candidates,
  };
}

export async function evaluateWikiSynthesis(
  rootDir: string,
  state: WikiMaintenanceState,
  modelRuntime: ModelRuntime,
  options: {
    now?: Date;
    language?: WikiLanguage;
    isStreaming?: () => boolean;
    isBudgetNearLimit?: () => boolean;
    createSession?: typeof createWikiSynthesisSession;
    runSynthesisFn?: typeof runWikiSynthesis;
  } = {},
): Promise<WikiSynthesisResult> {
  const now = options.now ?? new Date();
  const pageCount = wikiPageCount(rootDir);

  if (options.isStreaming?.()) {
    return { state, ran: false, pagesCreated: 0, candidates: [] };
  }
  if (options.isBudgetNearLimit?.()) {
    return { state, ran: false, pagesCreated: 0, candidates: [] };
  }
  if (!shouldRunWikiSynthesis(state, pageCount, now)) {
    return { state, ran: false, pagesCreated: 0, candidates: [] };
  }

  const run = options.runSynthesisFn ?? runWikiSynthesis;
  return run(rootDir, state, modelRuntime, options.language, now, {
    createSession: options.createSession,
  });
}
