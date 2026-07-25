// tests/steps/consolidation-relocate.steps.ts — FR-CONSOL-07 relocate tool BDD.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";

import {
  buildConsolidationTools,
  executeConsolidationTool,
} from "../../backends/consolidation-tools";
import { initTestGitRepo } from "../support/test-git";
import type { AbWorld } from "../support/world";

interface RelocateWorld extends AbWorld {
  relocateTmpDir?: string;
  abDir?: string;
  lastToolError?: string;
  lastToolResult?: string;
}

After(function (this: RelocateWorld) {
  if (this.relocateTmpDir) rmSync(this.relocateTmpDir, { recursive: true, force: true });
});

function writeBrainFile(abDir: string, relPath: string, content: string): void {
  const abs = join(abDir, relPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
}

Given("an AB instance with {string}", async function (this: RelocateWorld, relPath: string) {
  this.relocateTmpDir = mkdtempSync(join(tmpdir(), "ab-relocate-bdd-"));
  this.abDir = join(this.relocateTmpDir, "buddy");
  mkdirSync(this.abDir, { recursive: true });
  writeFileSync(join(this.abDir, "AGENTS.md"), "# Rules\n");
  writeBrainFile(this.abDir, relPath, "# File\n");
  await initTestGitRepo(this.abDir);
  await simpleGit(this.abDir).add("-A").commit("seed");
});

Given(
  "{string} contains a link to {string}",
  function (this: RelocateWorld, relPath: string, href: string) {
    if (!this.abDir) throw new Error("AB instance not initialized");
    writeBrainFile(this.abDir, relPath, `# Bar\n\nSee [foo](${href}).\n`);
  },
);

When(
  "the consolidation tool relocate_brain_file is called with source {string} and destination {string}",
  async function (this: RelocateWorld, source: string, destination: string) {
    if (!this.abDir) throw new Error("AB instance not initialized");
    const tools = buildConsolidationTools(this.abDir);
    try {
      this.lastToolResult = await executeConsolidationTool(tools, "relocate_brain_file", {
        source,
        destination,
      });
      this.lastToolError = undefined;
    } catch (error) {
      this.lastToolError = error instanceof Error ? error.message : String(error);
      this.lastToolResult = undefined;
    }
  },
);

When(
  "relocate_brain_file is called with source {string} and destination {string}",
  async function (this: RelocateWorld, source: string, destination: string) {
    if (!this.abDir) throw new Error("AB instance not initialized");
    const tools = buildConsolidationTools(this.abDir);
    try {
      this.lastToolResult = await executeConsolidationTool(tools, "relocate_brain_file", {
        source,
        destination,
      });
      this.lastToolError = undefined;
    } catch (error) {
      this.lastToolError = error instanceof Error ? error.message : String(error);
      this.lastToolResult = undefined;
    }
  },
);

Then("{string} exists", function (this: RelocateWorld, relPath: string) {
  if (!this.abDir) throw new Error("AB instance not initialized");
  assert.ok(existsSync(join(this.abDir, relPath)), `expected ${relPath} to exist`);
});

Then("{string} does not exist", function (this: RelocateWorld, relPath: string) {
  if (!this.abDir) throw new Error("AB instance not initialized");
  assert.ok(!existsSync(join(this.abDir, relPath)), `expected ${relPath} to not exist`);
});

Then(
  "{string} link is updated to {string}",
  function (this: RelocateWorld, relPath: string, expectedHref: string) {
    if (!this.abDir) throw new Error("AB instance not initialized");
    const content = readFileSync(join(this.abDir, relPath), "utf8");
    assert.ok(
      content.includes(`](${expectedHref})`),
      `expected link href ${expectedHref} in ${relPath}, got:\n${content}`,
    );
  },
);

Then("the tool returns an error {string}", function (this: RelocateWorld, expected: string) {
  assert.equal(this.lastToolError, expected, `expected error "${expected}"`);
});

Then("the tool returns an error containing {string}", function (this: RelocateWorld, expected: string) {
  assert.ok(
    this.lastToolError?.includes(expected),
    `expected error to contain "${expected}", got: ${this.lastToolError ?? "(none)"}`,
  );
});
