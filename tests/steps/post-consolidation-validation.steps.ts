// tests/steps/post-consolidation-validation.steps.ts — FR-GUARD-03 BDD steps.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { runPostConsolidationValidation } from "../../backends/post-consolidation-validation";

interface PostConsolWorld {
  tmpDir?: string;
  newFiles?: string[];
  touchedFiles?: string[];
  result?: ReturnType<typeof runPostConsolidationValidation>;
}

After(function (this: PostConsolWorld) {
  if (this.tmpDir) rmSync(this.tmpDir, { recursive: true, force: true });
});

function ensureWorld(this: PostConsolWorld): string {
  if (!this.tmpDir) {
    this.tmpDir = mkdtempSync(join(tmpdir(), "buddy-post-consol-"));
    this.newFiles = [];
    this.touchedFiles = [];
  }
  return this.tmpDir;
}

function writeRel(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

Given(
  "a new brain file {string} in the repo",
  function (this: PostConsolWorld, relPath: string) {
    const root = ensureWorld.call(this);
    writeRel(root, relPath, "# Test\n\nBody.\n");
    this.newFiles!.push(relPath);
    if (!this.touchedFiles!.includes(relPath)) this.touchedFiles!.push(relPath);
  },
);

Given(
  "a touched file {string} linking to {string}",
  function (this: PostConsolWorld, relPath: string, linkTarget: string) {
    const root = ensureWorld.call(this);
    writeRel(root, relPath, `# Index\n\nSee [link](${linkTarget}).\n`);
    if (!this.touchedFiles!.includes(relPath)) this.touchedFiles!.push(relPath);
  },
);

Given(
  "a touched file {string} containing {string}",
  function (this: PostConsolWorld, relPath: string, snippet: string) {
    const root = ensureWorld.call(this);
    writeRel(root, relPath, `# File\n\n${snippet}\n`);
    if (!this.touchedFiles!.includes(relPath)) this.touchedFiles!.push(relPath);
  },
);

Given(
  "an existing file {string}",
  function (this: PostConsolWorld, relPath: string) {
    const root = ensureWorld.call(this);
    writeRel(root, relPath, "# Existing\n");
  },
);

Given(
  "an untouched file {string} containing {string}",
  function (this: PostConsolWorld, relPath: string, snippet: string) {
    const root = ensureWorld.call(this);
    writeRel(root, relPath, `# Untouched\n\n${snippet}\n`);
  },
);

When("post-consolidation validation runs on the touched files", function (this: PostConsolWorld) {
  assert.ok(this.tmpDir);
  this.result = runPostConsolidationValidation(
    this.tmpDir,
    this.newFiles ?? [],
    this.touchedFiles ?? [],
  );
});

Then(
  "the file is renamed to {string}",
  function (this: PostConsolWorld, relPath: string) {
    assert.ok(existsSync(join(this.tmpDir!, relPath)), `expected ${relPath} to exist`);
    const renamed = this.result?.renames.some((r) => r.to === relPath);
    assert.ok(renamed, `expected a rename to ${relPath}, got ${JSON.stringify(this.result?.renames)}`);
  },
);

Then("no files are renamed", function (this: PostConsolWorld) {
  assert.equal(this.result?.renames.length ?? 0, 0);
});

Then("{string} links to {string}", function (this: PostConsolWorld, relPath: string, target: string) {
  const content = readFileSync(join(this.tmpDir!, relPath), "utf8");
  assert.ok(content.includes(`](${target})`), `expected link to ${target} in:\n${content}`);
});

Then("{string} contains {string}", function (this: PostConsolWorld, relPath: string, text: string) {
  const content = readFileSync(join(this.tmpDir!, relPath), "utf8");
  assert.ok(content.includes(text), `expected "${text}" in:\n${content}`);
});

Then(
  "{string} does not contain {string}",
  function (this: PostConsolWorld, relPath: string, text: string) {
    const content = readFileSync(join(this.tmpDir!, relPath), "utf8");
    assert.ok(!content.includes(text), `did not expect "${text}" in:\n${content}`);
  },
);

Then(
  "{string} still contains {string}",
  function (this: PostConsolWorld, relPath: string, text: string) {
    const content = readFileSync(join(this.tmpDir!, relPath), "utf8");
    assert.ok(content.includes(text), `expected "${text}" in:\n${content}`);
  },
);
