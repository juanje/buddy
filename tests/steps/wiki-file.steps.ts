// tests/steps/wiki-file.steps.ts — FR-WIKI-01/03/09 wiki_file BDD.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildWikiFileTool,
  executeWikiFileTool,
  type WikiFileOutput,
} from "../../backends/wiki-file";
import { toIsoDay } from "../../shared/dates";
import { WIKI_DIR } from "../../shared/brain-paths";
import { formatWikiPage, parseWikiFrontmatter } from "../../backends/wiki-format";
import type { BuddyWorld } from "../support/world";

interface WikiFileWorld extends BuddyWorld {
  buddyDir?: string;
  fileTools?: ReturnType<typeof buildWikiFileTool>;
  lastFileText?: string;
  lastFileDetails?: WikiFileOutput;
}

function wikiPath(world: WikiFileWorld, rel: string): string {
  return join(world.buddyDir!, rel);
}

Given("wiki_file tools are available", function (this: WikiFileWorld) {
  const buddyDir = this.buddyDir ?? this.rootDir;
  assert.ok(buddyDir, "buddyDir must be set");
  this.buddyDir = buddyDir;
  this.fileTools = buildWikiFileTool(buddyDir, "en");
});

Given("the buddy has no wiki directory", function (this: WikiFileWorld) {
  const wikiDir = wikiPath(this, WIKI_DIR);
  if (existsSync(wikiDir)) rmSync(wikiDir, { recursive: true, force: true });
});

Given(
  'an existing wiki page {string} titled {string}',
  function (this: WikiFileWorld, relPath: string, title: string) {
    const abs = wikiPath(this, `${WIKI_DIR}/${relPath}`);
    mkdirSync(join(abs, ".."), { recursive: true });
    const category = relPath.split("/")[0];
    writeFileSync(
      abs,
      formatWikiPage({
        title,
        summary: `${title} summary.`,
        tags: [category],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["Existing point."],
      }),
      "utf8",
    );
  },
);

Given("an existing wiki page {string} with connection to beta", function (this: WikiFileWorld, relPath: string) {
  const abs = wikiPath(this, `${WIKI_DIR}/${relPath}`);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(
    join(wikiPath(this, WIKI_DIR), "concepts/beta.md"),
    formatWikiPage({
      title: "Beta",
      summary: "Beta page.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
    }),
    "utf8",
  );
  writeFileSync(
    abs,
    formatWikiPage({
      title: "Alpha",
      summary: "Alpha page.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      connections: [{ path: "beta.md", description: "original link" }],
    }),
    "utf8",
  );
});

Given("an existing wiki page {string} with {int} content lines", function (this: WikiFileWorld, relPath: string, lines: number) {
  const abs = wikiPath(this, `${WIKI_DIR}/${relPath}`);
  mkdirSync(join(abs, ".."), { recursive: true });
  const keyPoints = Array.from({ length: lines - 3 }, (_, i) => `Line ${i + 1}`);
  writeFileSync(
    abs,
    formatWikiPage({
      title: "Large",
      summary: "Large page.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints,
    }),
    "utf8",
  );
});

When(
  "wiki_file is called to create {string} in category {string} with a connection to equilibrio",
  async function (this: WikiFileWorld, title: string, category: string) {
    const result = await executeWikiFileTool(this.fileTools!, {
      title,
      summary: "Estados hacia los que tiende un sistema.",
      key_points: ["Los atractores dan estabilidad."],
      tags: ["sistemas-complejos", "atractores"],
      category,
      connections: [{ path: "equilibrio-dinamico.md", description: "estabilidad dinámica" }],
    });
    this.lastFileText = result.text;
    this.lastFileDetails = result.details;
  },
);

When(
  "wiki_file is called to create {string} in category {string}",
  async function (this: WikiFileWorld, title: string, category: string) {
    const result = await executeWikiFileTool(this.fileTools!, {
      title,
      summary: `${title} summary.`,
      key_points: ["A key point."],
      tags: [category.replace(/"/g, "")],
      category: category.replace(/"/g, ""),
      connections: [],
    });
    this.lastFileText = result.text;
    this.lastFileDetails = result.details;
  },
);

When(
  'wiki_file enriches {string} with a new key point {string}',
  async function (this: WikiFileWorld, title: string, point: string) {
    const result = await executeWikiFileTool(this.fileTools!, {
      title,
      summary: "ignored on enrich",
      key_points: [point],
      tags: ["concepts"],
      category: "concepts",
      connections: [],
    });
    this.lastFileText = result.text;
    this.lastFileDetails = result.details;
  },
);

When(
  "wiki_file enriches {string} with enough key points to exceed the size guard",
  async function (this: WikiFileWorld, title: string) {
    const points = Array.from({ length: 5 }, (_, i) => `Overflow point ${i + 1}`);
    const result = await executeWikiFileTool(this.fileTools!, {
      title,
      summary: "overflow",
      key_points: points,
      tags: ["concepts"],
      category: "concepts",
      connections: [],
    });
    this.lastFileText = result.text;
    this.lastFileDetails = result.details;
  },
);

When(
  'wiki_file enriches {string} adding the same beta connection with a different description',
  async function (this: WikiFileWorld, title: string) {
    const result = await executeWikiFileTool(this.fileTools!, {
      title,
      summary: "alpha",
      key_points: [],
      tags: ["concepts"],
      category: "concepts",
      connections: [{ path: "beta.md", description: "duplicate attempt" }],
    });
    this.lastFileText = result.text;
    this.lastFileDetails = result.details;
  },
);

When(
  "wiki_file is called with tags sources and summary for {string}",
  async function (this: WikiFileWorld, title: string) {
    const result = await executeWikiFileTool(this.fileTools!, {
      title,
      summary: "Tagged summary line.",
      key_points: ["One point."],
      tags: ["test-tag"],
      category: "concepts",
      connections: [],
      sources: ["user/notes.md"],
    });
    this.lastFileText = result.text;
    this.lastFileDetails = result.details;
  },
);

Then("the wiki page {string} exists", function (this: WikiFileWorld, relPath: string) {
  assert.ok(existsSync(wikiPath(this, `${WIKI_DIR}/${relPath}`)));
});

Then("the wiki page {string} contains {string}", function (this: WikiFileWorld, relPath: string, text: string) {
  const content = readFileSync(wikiPath(this, `${WIKI_DIR}/${relPath}`), "utf8");
  assert.ok(content.includes(text), `expected ${relPath} to contain "${text}"`);
});

Then("the wiki page {string} contains tag {string}", function (this: WikiFileWorld, relPath: string, tag: string) {
  const content = readFileSync(wikiPath(this, `${WIKI_DIR}/${relPath}`), "utf8");
  const fm = parseWikiFrontmatter(content);
  assert.ok(fm.tags.includes(tag.replace(/"/g, "")), `expected tag ${tag} in ${fm.tags}`);
});

Then(
  'the wiki page {string} has a backlink to atractor',
  function (this: WikiFileWorld, relPath: string) {
    const content = readFileSync(wikiPath(this, `${WIKI_DIR}/${relPath}`), "utf8");
    assert.ok(content.includes("atractor.md"), `expected backlink in:\n${content}`);
  },
);

Then("the wiki directory {string} exists", function (this: WikiFileWorld, rel: string) {
  assert.ok(existsSync(wikiPath(this, rel)));
});

Then("the buddy file {string} exists", function (this: WikiFileWorld, rel: string) {
  assert.ok(existsSync(wikiPath(this, rel)));
});

Then("the wiki file result action is {string}", function (this: WikiFileWorld, action: string) {
  assert.equal(this.lastFileDetails?.filed[0]?.action, action);
});

Then("a new wiki page is created instead of enriching", function (this: WikiFileWorld) {
  assert.equal(this.lastFileDetails?.filed[0]?.action, "created");
  assert.ok(this.lastFileDetails?.filed[0]?.page.includes("continued"));
});

Then("the new page links to the existing page with see also", function (this: WikiFileWorld) {
  const page = this.lastFileDetails?.filed[0]?.page;
  assert.ok(page);
  const content = readFileSync(wikiPath(this, `${WIKI_DIR}/${page}`), "utf8");
  assert.ok(content.includes("see also"));
  assert.ok(content.includes("large.md"));
});

Then(
  'the wiki page {string} has exactly one connection to beta',
  function (this: WikiFileWorld, relPath: string) {
    const content = readFileSync(wikiPath(this, `${WIKI_DIR}/${relPath}`), "utf8");
    const matches = content.match(/beta\.md/g) ?? [];
    assert.equal(matches.length, 1);
  },
);

Then(
  'the wiki page frontmatter has tags {string} and source {string}',
  function (this: WikiFileWorld, _tagField: string, source: string) {
    const page = this.lastFileDetails?.filed[0]?.page;
    assert.ok(page);
    const fm = parseWikiFrontmatter(readFileSync(wikiPath(this, `${WIKI_DIR}/${page}`), "utf8"));
    assert.ok(fm.tags.includes("test-tag"));
    assert.ok(fm.sources.includes(source.replace(/"/g, "")));
  },
);

Then("the wiki page frontmatter updated date is today", function (this: WikiFileWorld) {
  const page = this.lastFileDetails?.filed[0]?.page;
  assert.ok(page);
  const fm = parseWikiFrontmatter(readFileSync(wikiPath(this, `${WIKI_DIR}/${page}`), "utf8"));
  assert.equal(fm.updated, toIsoDay(new Date()));
});

Then('the buddy file {string} lists {string}', function (this: WikiFileWorld, rel: string, text: string) {
  const content = readFileSync(wikiPath(this, rel), "utf8");
  assert.ok(content.includes(text.replace(/"/g, "")), `expected ${rel} to list "${text}"`);
});

Then('the buddy file {string} lists tag {string}', function (this: WikiFileWorld, rel: string, tag: string) {
  const content = readFileSync(wikiPath(this, rel), "utf8");
  assert.ok(content.includes(`## ${tag.replace(/"/g, "")}`));
});
