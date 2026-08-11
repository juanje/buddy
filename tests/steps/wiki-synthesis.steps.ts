// tests/steps/wiki-synthesis.steps.ts — FR-WIKI-06 wiki synthesis BDD.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildCappedWikiFileTools,
  evaluateWikiSynthesis,
  runWikiSynthesis,
  wikiSynthesisCandidates,
  WIKI_SYNTHESIS_MAX_PAGES_PER_RUN,
  type SynthesisCandidate,
  type WikiSynthesisResult,
  type WikiSynthesisSessionLike,
} from "../../backends/wiki-synthesis";
import { buildWikiFileTool, executeWikiFileTool } from "../../backends/wiki-file";
import { WIKI_DIR } from "../../shared/brain-paths";
import { defaultWikiState, saveWikiState, type WikiMaintenanceState } from "../../shared/wiki-state";
import { formatWikiPage } from "../../backends/wiki-format";
import { regenerateWikiIndex } from "../../backends/wiki-index";
import type { BuddyWorld } from "../support/world";

interface WikiSynthesisWorld extends BuddyWorld {
  buddyDir?: string;
  fileTools?: ReturnType<typeof buildWikiFileTool>;
  lastCandidates?: SynthesisCandidate[];
  mockSession?: WikiSynthesisSessionLike;
  capCounters?: { created: number; rejected: boolean };
  lastSynthesisResult?: WikiSynthesisResult;
  wikiState?: WikiMaintenanceState;
}

function wikiPath(world: WikiSynthesisWorld, rel: string): string {
  return join(world.buddyDir!, rel);
}

function writeWikiPage(
  world: WikiSynthesisWorld,
  relPath: string,
  data: Parameters<typeof formatWikiPage>[0],
): void {
  const abs = wikiPath(world, `${WIKI_DIR}/${relPath}`);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, formatWikiPage(data), "utf8");
}

Given(
  'wiki pages tagged with {string} on 3 pages without an Emergence page',
  function (this: WikiSynthesisWorld, tag: string) {
    mkdirSync(wikiPath(this, `${WIKI_DIR}/concepts`), { recursive: true });
    for (let i = 1; i <= 3; i++) {
      writeWikiPage(this, `concepts/page-${i}.md`, {
        title: `Page ${i}`,
        summary: `Summary ${i}.`,
        tags: [tag, "concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(this.buddyDir!);
  },
);

Given(
  'wiki pages tagged with {string} and a page titled {string}',
  function (this: WikiSynthesisWorld, tag: string, title: string) {
    writeWikiPage(this, "concepts/hub.md", {
      title,
      summary: `${title} hub.`,
      tags: [tag],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    for (let i = 1; i <= 3; i++) {
      writeWikiPage(this, `concepts/other-${i}.md`, {
        title: `Other ${i}`,
        summary: `Other ${i}.`,
        tags: [tag],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(this.buddyDir!);
  },
);

Given(
  "3 wiki pages each tagged with both {string} and {string}",
  function (this: WikiSynthesisWorld, tagA: string, tagB: string) {
    for (let i = 1; i <= 3; i++) {
      writeWikiPage(this, `concepts/pair-${i}.md`, {
        title: `Pair ${i}`,
        summary: `Pair ${i}.`,
        tags: [tagA, tagB],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      });
    }
    regenerateWikiIndex(this.buddyDir!);
  },
);

Given(
  'wiki pages {string} and {string} sharing tags {string} and {string} with no connection between them',
  function (
    this: WikiSynthesisWorld,
    titleA: string,
    titleB: string,
    tagA: string,
    tagB: string,
  ) {
    const slugA = titleA.toLowerCase();
    const slugB = titleB.toLowerCase();
    writeWikiPage(this, `concepts/${slugA}.md`, {
      title: titleA.charAt(0).toUpperCase() + titleA.slice(1),
      summary: `${titleA} page.`,
      tags: [tagA, tagB],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    writeWikiPage(this, `concepts/${slugB}.md`, {
      title: titleB.charAt(0).toUpperCase() + titleB.slice(1),
      summary: `${titleB} page.`,
      tags: [tagA, tagB],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    });
    regenerateWikiIndex(this.buddyDir!);
  },
);

When("synthesis candidates are scanned", function (this: WikiSynthesisWorld) {
  this.lastCandidates = wikiSynthesisCandidates(this.buddyDir!);
});

Then(
  'an orphan-tag candidate for {string} is found',
  function (this: WikiSynthesisWorld, tag: string) {
    const found = this.lastCandidates?.find((c) => c.type === "orphan-tag" && c.label === tag);
    assert.ok(found, `expected orphan-tag candidate for ${tag}, got: ${JSON.stringify(this.lastCandidates)}`);
  },
);

Then(
  'no orphan-tag candidate for {string} is found',
  function (this: WikiSynthesisWorld, tag: string) {
    const found = this.lastCandidates?.find((c) => c.type === "orphan-tag" && c.label === tag);
    assert.equal(found, undefined);
  },
);

Then(
  'a co-occurrence candidate for tags {string} and {string} is found',
  function (this: WikiSynthesisWorld, tagA: string, tagB: string) {
    const label = `${tagA} + ${tagB}`;
    const found = this.lastCandidates?.find((c) => c.type === "co-occurrence" && c.label === label);
    assert.ok(found, `expected co-occurrence candidate ${label}`);
  },
);

Then("a disconnected-cluster candidate linking those pages is found", function (this: WikiSynthesisWorld) {
  const found = this.lastCandidates?.find((c) => c.type === "disconnected-cluster");
  assert.ok(found, `expected disconnected-cluster candidate, got: ${JSON.stringify(this.lastCandidates)}`);
});

// --- Scenarios 5–8: session/heartbeat ---

Given("wiki synthesis is triggered with a mock session", function (this: WikiSynthesisWorld) {
  this.mockSession = {
    async prompt() {
      // filled in by When step
    },
    dispose() {},
    pagesCreated: () => 0,
    capRejected: () => false,
  };
  this.lastSynthesisResult = undefined;
});

Given(
  "wiki synthesis is triggered with a mock session and 4 approved candidates",
  function (this: WikiSynthesisWorld) {
    this.capCounters = { created: 0, rejected: false };
    const buddyDir = this.buddyDir!;
    const cappedTools = buildCappedWikiFileTools(
      buddyDir,
      "en",
      WIKI_SYNTHESIS_MAX_PAGES_PER_RUN,
      this.capCounters,
    );
    this.mockSession = {
      async prompt() {
        for (let i = 0; i < 4; i++) {
          await executeWikiFileTool(cappedTools, {
            title: `Synth ${i}`,
            summary: `Summary ${i}.`,
            key_points: ["One", "Two", "Three", "Four", "Five"],
            tags: ["concepts"],
            category: "concepts",
            connections: [],
          });
        }
      },
      dispose() {},
      pagesCreated: () => this.capCounters!.created,
      capRejected: () => this.capCounters!.rejected,
    };
  },
);

Given(
  "wiki-state with synthesis last run at {int} pages and current page count {int}",
  function (this: WikiSynthesisWorld, pagesAtLast: number, _currentCount: number) {
    this.wikiState = {
      ...defaultWikiState(),
      lastSynthesis: "2026-08-01T00:00:00.000Z",
      pagesAtLastSynthesis: pagesAtLast,
    };
    saveWikiState(this.buddyDir!, this.wikiState);
  },
);

Given(
  "wiki-state with synthesis last run {int} days ago and cooldown {int} days",
  function (this: WikiSynthesisWorld, daysAgo: number, cooldownDays: number) {
    const last = new Date("2026-08-11T00:00:00.000Z");
    last.setDate(last.getDate() - daysAgo);
    this.wikiState = {
      ...defaultWikiState(),
      lastSynthesis: last.toISOString(),
      pagesAtLastSynthesis: 0,
      synthesisCooldownDays: cooldownDays,
    };
    saveWikiState(this.buddyDir!, this.wikiState);
  },
);

When("the mock session approves the orphan-tag candidate", async function (this: WikiSynthesisWorld) {
  const buddyDir = this.buddyDir!;
  const counters = { created: 0, rejected: false };
  const cappedTools = buildCappedWikiFileTools(buddyDir, "en", WIKI_SYNTHESIS_MAX_PAGES_PER_RUN, counters);

  const session: WikiSynthesisSessionLike = {
    async prompt() {
      await executeWikiFileTool(cappedTools, {
        title: "Emergence",
        summary: "Emergent concept from related pages.",
        key_points: ["One", "Two", "Three", "Four", "Five"],
        tags: ["emergence", "concepts"],
        category: "concepts",
        connections: wikiSynthesisCandidates(buddyDir)
          .find((c) => c.type === "orphan-tag")
          ?.relatedPages.map((path) => ({ path, description: "related page" })) ?? [],
        sources: ["synthesis"],
      });
    },
    dispose() {},
    pagesCreated: () => counters.created,
    capRejected: () => counters.rejected,
  };

  this.lastSynthesisResult = await runWikiSynthesis(buddyDir, defaultWikiState(), {} as never, "en", new Date(), {
    createSession: async () => session,
  });
});

When("the mock session attempts to create all pages", async function (this: WikiSynthesisWorld) {
  assert.ok(this.mockSession, "mock session must be set");
  await this.mockSession.prompt("");
  this.lastSynthesisResult = {
    state: defaultWikiState(),
    ran: true,
    pagesCreated: this.mockSession.pagesCreated(),
    candidates: [],
  };
});

When("wiki synthesis is evaluated on heartbeat", async function (this: WikiSynthesisWorld) {
  const state = this.wikiState ?? defaultWikiState();
  this.lastSynthesisResult = await evaluateWikiSynthesis(this.buddyDir!, state, {} as never, {
    now: new Date("2026-08-11T00:00:00.000Z"),
  });
});

Then('a wiki page for {string} exists with origin synthesis', function (this: WikiSynthesisWorld, title: string) {
  const slug = title.toLowerCase();
  const candidates = [
    join(WIKI_DIR, "concepts", `${slug}.md`),
    join(WIKI_DIR, "concepts", `${slug.replace(/\s+/g, "-")}.md`),
  ];
  const found = candidates.find((rel) => existsSync(wikiPath(this, rel)));
  assert.ok(found, `expected synthesis page for ${title}`);
  const content = readFileSync(wikiPath(this, found!), "utf8");
  assert.ok(content.includes("synthesis"), `expected synthesis origin in:\n${content}`);
});

Then("only {int} synthesis pages were created", function (this: WikiSynthesisWorld, count: number) {
  assert.equal(this.capCounters?.created ?? this.lastSynthesisResult?.pagesCreated, count);
});

Then("the 4th wiki_file call was rejected by the cap", function (this: WikiSynthesisWorld) {
  assert.equal(this.capCounters?.rejected, true);
});

Then("wiki synthesis did not run", function (this: WikiSynthesisWorld) {
  assert.equal(this.lastSynthesisResult?.ran, false);
});
