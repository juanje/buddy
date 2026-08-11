// tests/steps/wiki-synthesis.steps.ts — FR-WIKI-06 wiki synthesis BDD.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  wikiSynthesisCandidates,
  type SynthesisCandidate,
} from "../../backends/wiki-synthesis";
import { buildWikiFileTool } from "../../backends/wiki-file";
import { WIKI_DIR } from "../../shared/brain-paths";
import { formatWikiPage } from "../../backends/wiki-format";
import { regenerateWikiIndex } from "../../backends/wiki-index";
import type { BuddyWorld } from "../support/world";

interface WikiSynthesisWorld extends BuddyWorld {
  buddyDir?: string;
  fileTools?: ReturnType<typeof buildWikiFileTool>;
  lastCandidates?: SynthesisCandidate[];
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

// --- Scenarios 5–8: session/heartbeat (commit 2) ---

Given("wiki synthesis is triggered with a mock session", function () {
  return "pending";
});

Given("wiki synthesis is triggered with a mock session and 4 approved candidates", function () {
  return "pending";
});

Given(
  "wiki-state with synthesis last run at {int} pages and current page count {int}",
  function () {
    return "pending";
  },
);

Given(
  "wiki-state with synthesis last run {int} days ago and cooldown {int} days",
  function () {
    return "pending";
  },
);

When("the mock session approves the orphan-tag candidate", function () {
  return "pending";
});

When("the mock session attempts to create all pages", function () {
  return "pending";
});

When("wiki synthesis is evaluated on heartbeat", function () {
  return "pending";
});

Then('a wiki page for {string} exists with origin synthesis', function () {
  return "pending";
});

Then("only {int} synthesis pages were created", function () {
  return "pending";
});

Then("the 4th wiki_file call was rejected by the cap", function () {
  return "pending";
});

Then("wiki synthesis did not run", function () {
  return "pending";
});
