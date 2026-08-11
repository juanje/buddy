// tests/steps/wiki-health.steps.ts — FR-WIKI-05 wiki health BDD.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { wikiCheck } from "../../backends/wiki-check";
import { executeWikiFileTool } from "../../backends/wiki-file";
import { WIKI_DIR } from "../../shared/brain-paths";
import { formatWikiPage } from "../../backends/wiki-format";
import { buildWikiFileTool, type WikiFileOutput } from "../../backends/wiki-file";
import type { BuddyWorld } from "../support/world";

interface WikiHealthWorld extends BuddyWorld {
  buddyDir?: string;
  fileTools?: ReturnType<typeof buildWikiFileTool>;
  lastFileText?: string;
  lastFileDetails?: WikiFileOutput;
  lastHealthReport?: ReturnType<typeof wikiCheck>;
}

function wikiPath(world: WikiHealthWorld, rel: string): string {
  return join(world.buddyDir!, rel);
}

When(
  'wiki_file is called to create {string} in category {string} with a connection to beta',
  async function (this: WikiHealthWorld, title: string, category: string) {
    const result = await executeWikiFileTool(this.fileTools!, {
      title,
      summary: `${title} summary.`,
      key_points: ["One", "Two", "Three", "Four", "Five"],
      tags: [category.replace(/"/g, "")],
      category: category.replace(/"/g, ""),
      connections: [{ path: "beta.md", description: "related concept" }],
    });
    this.lastFileText = result.text;
    this.lastFileDetails = result.details;
  },
);

Given(
  'an existing wiki page {string} with connection to alpha',
  function (this: WikiHealthWorld, relPath: string) {
    const betaAbs = wikiPath(this, `${WIKI_DIR}/${relPath}`);
    mkdirSync(join(betaAbs, ".."), { recursive: true });
    writeFileSync(
      join(wikiPath(this, WIKI_DIR), "concepts/alpha.md"),
      formatWikiPage({
        title: "Alpha",
        summary: "Alpha page.",
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
        connections: [{ path: "beta.md", description: "links to beta" }],
      }),
      "utf8",
    );
    writeFileSync(
      betaAbs,
      formatWikiPage({
        title: "Beta",
        summary: "Beta page.",
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      }),
      "utf8",
    );
  },
);

Then(
  'the wiki page {string} has a backlink to alpha',
  function (this: WikiHealthWorld, relPath: string) {
    const content = readFileSync(wikiPath(this, `${WIKI_DIR}/${relPath}`), "utf8");
    assert.ok(content.includes("alpha.md"), `expected backlink to alpha in:\n${content}`);
  },
);

Given(
  'the wiki page {string} has no backlink to alpha',
  function (this: WikiHealthWorld, relPath: string) {
    const abs = wikiPath(this, `${WIKI_DIR}/${relPath}`);
    let content = readFileSync(abs, "utf8");
    content = content.replace(/- \[[^\]]*\]\([^)]*alpha\.md[^)]*\)[^\n]*\n?/g, "");
    writeFileSync(abs, content, "utf8");
    assert.ok(!content.includes("alpha.md"), "backlink should be removed");
  },
);

Given(
  'the wiki page {string} has a broken wiki-root connection to beta',
  function (this: WikiHealthWorld, relPath: string) {
    const abs = wikiPath(this, `${WIKI_DIR}/${relPath}`);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(
      abs,
      formatWikiPage({
        title: "Alpha",
        summary: "Alpha with broken link.",
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
        connections: [{ path: "concepts/beta.md", description: "wiki-root style" }],
      }),
      "utf8",
    );
  },
);

Then("the wiki health report has no orphans", function (this: WikiHealthWorld) {
  this.lastHealthReport = wikiCheck(this.buddyDir!);
  assert.deepEqual(this.lastHealthReport.orphans, []);
});

Then("the wiki health report has no broken links", function (this: WikiHealthWorld) {
  this.lastHealthReport = wikiCheck(this.buddyDir!);
  assert.deepEqual(this.lastHealthReport.brokenLinks, []);
});
