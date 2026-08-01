// tests/steps/show-file.steps.ts — FR-CHAT-17 show_file BDD steps.
//
// Drives the real tool against a real directory. The frontend is represented by
// the callback the worker would push through `FrontendAPI.onShowFile`, so what
// is asserted is "the viewer was asked to open this", which is the whole
// observable effect of the tool succeeding.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildShowFileTools, executeShowFileTool } from "../../backends/show-file-tool";
import type { BuddyWorld } from "../support/world";

interface ShowFileWorld extends BuddyWorld {
  showFileDir?: string;
  showFileOutsideDir?: string;
  showFileTools?: ReturnType<typeof buildShowFileTools>;
  shownPaths?: string[];
  showFileResult?: string;
  showFileError?: string;
}

After(function (this: ShowFileWorld) {
  for (const dir of [this.showFileDir, this.showFileOutsideDir]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

Given("a buddy repository with show_file available", function (this: ShowFileWorld) {
  this.showFileDir = mkdtempSync(join(tmpdir(), "buddy-showfile-"));
  this.shownPaths = [];
  this.showFileTools = buildShowFileTools({
    rootDir: this.showFileDir,
    showFile: (relPath: string) => {
      this.shownPaths?.push(relPath);
    },
  });
});

Given(
  "a readable repository file {string} with content {string}",
  function (this: ShowFileWorld, relPath: string, content: string) {
    const abs = join(this.showFileDir!, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  },
);

Given(
  "{string} is a symlink to a file outside the buddy directory",
  function (this: ShowFileWorld, relPath: string) {
    this.showFileOutsideDir = mkdtempSync(join(tmpdir(), "buddy-outside-"));
    const target = join(this.showFileOutsideDir, "secret.md");
    writeFileSync(target, "# Secret");
    const link = join(this.showFileDir!, relPath);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link);
  },
);

When("the agent shows the file {string}", async function (this: ShowFileWorld, path: string) {
  this.showFileResult = undefined;
  this.showFileError = undefined;
  try {
    this.showFileResult = await executeShowFileTool(this.showFileTools!, "show_file", { path });
  } catch (error) {
    this.showFileError = error instanceof Error ? error.message : String(error);
  }
});

Then("the viewer is asked to open {string}", function (this: ShowFileWorld, relPath: string) {
  assert.deepEqual(this.shownPaths, [relPath]);
});

Then("the viewer is not asked to open anything", function (this: ShowFileWorld) {
  assert.deepEqual(this.shownPaths, []);
});

Then("show_file reports success", function (this: ShowFileWorld) {
  assert.equal(this.showFileError, undefined);
  assert.ok(this.showFileResult && this.showFileResult.length > 0);
});

Then("show_file is refused", function (this: ShowFileWorld) {
  const error = this.showFileError;
  assert.ok(error, `expected a refusal, got: ${this.showFileResult}`);
  // Something the agent can relay, not a stack trace.
  assert.ok(!error.includes("at "), error);
});

Then("the refusal mentions {string}", function (this: ShowFileWorld, text: string) {
  const error = this.showFileError ?? "(no refusal)";
  assert.ok(error.includes(text), error);
});
