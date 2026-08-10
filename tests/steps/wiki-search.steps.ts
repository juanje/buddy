// tests/steps/wiki-search.steps.ts — FR-WIKI-04 wiki_search BDD.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildWikiSearchTool,
  executeWikiSearchTool,
  type WikiSearchOutput,
  type WikiSearchScope,
} from "../../backends/wiki-search";
import { WIKI_DIR } from "../../shared/brain-paths";
import { formatWikiPage } from "../../backends/wiki-format";
import type { BuddyWorld } from "../support/world";

interface WikiSearchWorld extends BuddyWorld {
  memoryTmpDir?: string;
  buddyDir?: string;
  searchTools?: ReturnType<typeof buildWikiSearchTool>;
  lastSearchText?: string;
  lastSearchDetails?: WikiSearchOutput;
}

After(function (this: WikiSearchWorld) {
  if (this.memoryTmpDir) rmSync(this.memoryTmpDir, { recursive: true, force: true });
});

function ensureSearchTools(world: WikiSearchWorld): void {
  const buddyDir = world.buddyDir ?? world.rootDir;
  assert.ok(buddyDir, "buddyDir must be set by an initialized buddy git repository");
  world.buddyDir = buddyDir;
  world.searchTools = buildWikiSearchTool(buddyDir);
}

Given("a wiki with sample pages for search", function (this: WikiSearchWorld) {
  ensureSearchTools(this);
  const wikiDir = join(this.buddyDir!, WIKI_DIR, "sistemas-complejos");
  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(
    join(wikiDir, "atractor.md"),
    formatWikiPage({
      title: "Atractor",
      summary: "Estados hacia los que tiende un sistema.",
      tags: ["sistemas-complejos", "atractores"],
      created: "2026-08-10",
      updated: "2026-08-10",
      intro: "Concepto central en sistemas complejos.",
      keyPoints: ["Los atractores dan estabilidad al sistema."],
    }),
    "utf8",
  );
  writeFileSync(
    join(wikiDir, "sistemas-complejos.md"),
    formatWikiPage({
      title: "Sistemas complejos",
      summary: "Definición y propiedades clave.",
      tags: ["sistemas-complejos"],
      created: "2026-08-10",
      updated: "2026-08-10",
      keyPoints: ["Propiedades emergentes."],
    }),
    "utf8",
  );
});

Given("the wiki has no pages", function (this: WikiSearchWorld) {
  ensureSearchTools(this);
  mkdirSync(join(this.buddyDir!, WIKI_DIR), { recursive: true });
});

When(
  'wiki_search is called with query {string} and scope {string}',
  async function (this: WikiSearchWorld, query: string, scope: string) {
    const result = await executeWikiSearchTool(this.searchTools!, {
      query,
      scope: scope as WikiSearchScope,
    });
    this.lastSearchText = result.text;
    this.lastSearchDetails = result.details;
  },
);

Then("the wiki search result contains {string}", function (this: WikiSearchWorld, expected: string) {
  assert.ok(
    this.lastSearchText?.includes(expected),
    `expected search result to contain "${expected}", got:\n${this.lastSearchText}`,
  );
});

Then("the wiki search result does not contain {string}", function (this: WikiSearchWorld, forbidden: string) {
  assert.ok(
    !this.lastSearchText?.includes(forbidden),
    `expected search result NOT to contain "${forbidden}"`,
  );
});

Then("the wiki search details include summary but not body content", function (this: WikiSearchWorld) {
  assert.ok(this.lastSearchDetails && this.lastSearchDetails.total > 0);
  const page = this.lastSearchDetails!.results[0];
  assert.ok(page.summary.length > 0);
  assert.ok(!this.lastSearchText?.includes("Los atractores dan estabilidad"));
});
