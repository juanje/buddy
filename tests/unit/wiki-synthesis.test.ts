// tests/unit/wiki-synthesis.test.ts — FR-WIKI-06 wiki synthesis candidates.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WIKI_DIR } from "../../shared/brain-paths";
import {
  buildCappedWikiFileTools,
  buildSynthesisPrompt,
  evaluateWikiSynthesis,
  runWikiSynthesis,
  shouldRunWikiSynthesis,
  SYNTHESIS_CAP_MESSAGE,
  wikiSynthesisCandidates,
  WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES,
  WIKI_SYNTHESIS_MAX_PAGES_PER_RUN,
  WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES,
  WIKI_SYNTHESIS_PAGE_GROWTH_THRESHOLD,
  type WikiSynthesisSessionLike,
} from "../../backends/wiki-synthesis";
import { executeWikiFileTool } from "../../backends/wiki-file";
import { defaultWikiState } from "../../shared/wiki-state";
import { formatWikiPage } from "../../backends/wiki-format";
import { regenerateWikiIndex } from "../../backends/wiki-index";
import { initTestGitRepo } from "../support/test-git";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "wiki-synthesis-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function wikiJoin(...parts: string[]): string {
  return join(root, WIKI_DIR, ...parts);
}

function writePage(relPath: string, data: Parameters<typeof formatWikiPage>[0]): void {
  mkdirSync(join(wikiJoin(relPath), ".."), { recursive: true });
  writeFileSync(wikiJoin(relPath), formatWikiPage(data), "utf8");
}

describe("wikiSynthesisCandidates", () => {
  it("returns no candidates for empty wiki", () => {
    expect(wikiSynthesisCandidates(root)).toEqual([]);
  });

  it("detects orphan tag with 3+ pages", () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    for (let i = 1; i <= WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES; i++) {
      writePage(`concepts/page-${i}.md`, {
        title: `Page ${i}`,
        summary: `Summary ${i}.`,
        tags: ["emergence", "concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    const orphan = candidates.find((c) => c.type === "orphan-tag" && c.label === "emergence");
    expect(orphan).toBeDefined();
    expect(orphan!.score).toBe(WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES);
    expect(orphan!.relatedPages).toHaveLength(WIKI_SYNTHESIS_ORPHAN_TAG_MIN_PAGES);
  });

  it("excludes tag that has a matching page title", () => {
    writePage("concepts/concepts.md", {
      title: "Concepts",
      summary: "Concepts hub.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    for (let i = 1; i <= 3; i++) {
      writePage(`concepts/other-${i}.md`, {
        title: `Other ${i}`,
        summary: `Other ${i}.`,
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    expect(candidates.some((c) => c.type === "orphan-tag" && c.label === "concepts")).toBe(false);
  });

  it("detects co-occurring tag pair on 3+ pages", () => {
    for (let i = 1; i <= WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES; i++) {
      writePage(`concepts/pair-${i}.md`, {
        title: `Pair ${i}`,
        summary: `Pair ${i}.`,
        tags: ["feedback", "systems"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    const pair = candidates.find((c) => c.type === "co-occurrence" && c.label === "feedback + systems");
    expect(pair).toBeDefined();
    expect(pair!.score).toBe(WIKI_SYNTHESIS_CO_OCCURRENCE_MIN_PAGES);
  });

  it("detects disconnected pages sharing tags", () => {
    writePage("concepts/alpha.md", {
      title: "Alpha",
      summary: "Alpha page.",
      tags: ["complex-systems", "attractors"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    writePage("concepts/beta.md", {
      title: "Beta",
      summary: "Beta page.",
      tags: ["complex-systems", "attractors"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    const cluster = candidates.find((c) => c.type === "disconnected-cluster");
    expect(cluster).toBeDefined();
    expect(cluster!.relatedPages).toEqual(
      expect.arrayContaining(["concepts/alpha.md", "concepts/beta.md"]),
    );
  });

  it("sorts candidates by score descending", () => {
    for (let i = 1; i <= 4; i++) {
      writePage(`concepts/em-${i}.md`, {
        title: `Emergence ${i}`,
        summary: `E ${i}.`,
        tags: ["emergence"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    writePage("concepts/a.md", {
      title: "A",
      summary: "A.",
      tags: ["feedback", "systems"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    writePage("concepts/b.md", {
      title: "B",
      summary: "B.",
      tags: ["feedback", "systems"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    writePage("concepts/c.md", {
      title: "C",
      summary: "C.",
      tags: ["feedback", "systems"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(root);

    const candidates = wikiSynthesisCandidates(root);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score);
    }
  });
});

describe("wiki synthesis runner", () => {
  it("buildSynthesisPrompt includes candidate labels", () => {
    const prompt = buildSynthesisPrompt([
      {
        type: "orphan-tag",
        label: "emergence",
        score: 3,
        relatedPages: ["a.md"],
        rationale: "test",
      },
    ]);
    expect(prompt).toContain("emergence");
    expect(prompt).toContain(String(WIKI_SYNTHESIS_MAX_PAGES_PER_RUN));
  });

  it("returns ran false when no candidates", async () => {
    const result = await runWikiSynthesis(root, defaultWikiState(), {} as never);
    expect(result.ran).toBe(false);
    expect(result.pagesCreated).toBe(0);
    expect(result.state.lastSynthesis).toBeTruthy();
  });

  it("enforces cap on wiki_file calls", async () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    const counters = { created: 0, rejected: false };
    const tools = buildCappedWikiFileTools(root, "en", WIKI_SYNTHESIS_MAX_PAGES_PER_RUN, counters);
    const input = {
      title: "Synth",
      summary: "Synth summary.",
      key_points: ["One"],
      tags: ["concepts"],
      category: "concepts",
      connections: [] as { path: string; description: string }[],
    };

    for (let i = 0; i < WIKI_SYNTHESIS_MAX_PAGES_PER_RUN; i++) {
      const result = await executeWikiFileTool(tools, { ...input, title: `Synth ${i}` });
      expect(result.text).not.toContain(SYNTHESIS_CAP_MESSAGE);
    }
    const blocked = await executeWikiFileTool(tools, { ...input, title: "Synth blocked" });
    expect(blocked.text).toContain(SYNTHESIS_CAP_MESSAGE);
    expect(counters.created).toBe(WIKI_SYNTHESIS_MAX_PAGES_PER_RUN);
    expect(counters.rejected).toBe(true);
  });

  it("updates state after mock session creates pages", async () => {
    await initTestGitRepo(root);
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    for (let i = 1; i <= 3; i++) {
      writePage(`concepts/page-${i}.md`, {
        title: `Page ${i}`,
        summary: `Summary ${i}.`,
        tags: ["emergence", "concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    const mockSession: WikiSynthesisSessionLike = {
      async prompt() {
        const tools = buildCappedWikiFileTools(root, "en", WIKI_SYNTHESIS_MAX_PAGES_PER_RUN, {
          created: 0,
          rejected: false,
        });
        await executeWikiFileTool(tools, {
          title: "Emergence",
          summary: "Emergent concept.",
          key_points: ["One", "Two", "Three", "Four", "Five"],
          tags: ["emergence", "concepts"],
          category: "concepts",
          connections: [],
          sources: ["synthesis"],
        });
      },
      dispose() {},
      pagesCreated: () => 1,
      capRejected: () => false,
    };

    const result = await runWikiSynthesis(root, defaultWikiState(), {} as never, "en", new Date(), {
      createSession: async () => mockSession,
    });
    expect(result.ran).toBe(true);
    expect(result.pagesCreated).toBe(1);
    expect(result.state.pagesAtLastSynthesis).toBeGreaterThan(0);
  });

  it("disposes session when prompt throws", async () => {
    mkdirSync(wikiJoin("concepts"), { recursive: true });
    for (let i = 1; i <= 3; i++) {
      writePage(`concepts/page-${i}.md`, {
        title: `Page ${i}`,
        summary: `Summary ${i}.`,
        tags: ["emergence", "concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(root);

    let disposed = false;
    await expect(
      runWikiSynthesis(root, defaultWikiState(), {} as never, "en", new Date(), {
        createSession: async () => ({
          async prompt() {
            throw new Error("boom");
          },
          dispose() {
            disposed = true;
          },
          pagesCreated: () => 0,
          capRejected: () => false,
        }),
      }),
    ).rejects.toThrow("boom");
    expect(disposed).toBe(true);
  });

  it("shouldRunWikiSynthesis respects page growth threshold", () => {
    const state = {
      ...defaultWikiState(),
      lastSynthesis: "2026-08-01T00:00:00.000Z",
      pagesAtLastSynthesis: 15,
    };
    const now = new Date("2026-08-11T00:00:00.000Z");
    expect(shouldRunWikiSynthesis(state, 20, now)).toBe(false);
    expect(shouldRunWikiSynthesis(state, 15 + WIKI_SYNTHESIS_PAGE_GROWTH_THRESHOLD, now)).toBe(true);
  });

  it("shouldRunWikiSynthesis respects cooldown", () => {
    const state = {
      ...defaultWikiState(),
      lastSynthesis: new Date("2026-08-09T00:00:00.000Z").toISOString(),
      pagesAtLastSynthesis: 0,
      synthesisCooldownDays: 7,
    };
    const now = new Date("2026-08-11T00:00:00.000Z");
    expect(shouldRunWikiSynthesis(state, 100, now)).toBe(false);
  });

  it("shouldRunWikiSynthesis returns initialize on first deployment", () => {
    const now = new Date("2026-08-11T00:00:00.000Z");
    expect(shouldRunWikiSynthesis(defaultWikiState(), 169, now)).toBe("initialize");
  });

  it("evaluateWikiSynthesis initializes state on first deployment without running", async () => {
    const result = await evaluateWikiSynthesis(root, defaultWikiState(), {} as never, {
      now: new Date("2026-08-11T00:00:00.000Z"),
    });
    expect(result.ran).toBe(false);
    expect(result.state.lastSynthesis).toBeTruthy();
    expect(result.state.pagesAtLastSynthesis).toBe(0);
  });

  it("evaluateWikiSynthesis skips when below growth threshold", async () => {
    const state = {
      ...defaultWikiState(),
      lastSynthesis: "2026-08-01T00:00:00.000Z",
      pagesAtLastSynthesis: 15,
    };
    const result = await evaluateWikiSynthesis(root, state, {} as never, {
      now: new Date("2026-08-11T00:00:00.000Z"),
    });
    expect(result.ran).toBe(false);
  });
});
