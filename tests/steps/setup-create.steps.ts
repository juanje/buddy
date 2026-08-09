// tests/steps/setup-create.steps.ts — FR-SETUP-06 deterministic buddy creation.
// Real filesystem + real git on temp dirs; the repo's own templates/ are the
// fixture. No mocks, no network, no LLM.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";

import { createBuddyInstance, defaultTemplatesDir } from "../../backends/create-buddy";
import { detectFirstRun } from "../../backends/setup";
import type { SetupConfig } from "../../shared/api";
import type { BuddyWorld } from "../support/world";

interface CreateWorld extends BuddyWorld {
  createTmpDir?: string;
  buddyDir?: string;
  createConfigPath?: string;
  setupConfig?: SetupConfig;
}

After(function (this: CreateWorld) {
  if (this.createTmpDir) rmSync(this.createTmpDir, { recursive: true, force: true });
});

Given("a completed wizard configuration", function (this: CreateWorld) {
  this.createTmpDir = mkdtempSync(join(tmpdir(), "buddy-create-"));
  this.buddyDir = join(this.createTmpDir, "buddy");
  this.createConfigPath = join(this.createTmpDir, "config.json");
  this.setupConfig = {
    rootDir: this.buddyDir,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    language: "es",
    name: "María",
    about: "Software engineer in Madrid",
  };
});

When("setup runs", async function (this: CreateWorld) {
  await createBuddyInstance({
    config: this.setupConfig!,
    configPath: this.createConfigPath!,
    templatesDir: defaultTemplatesDir(),
  });
});

Then(
  "the buddy directory contains {string}, {string} and {string}",
  function (this: CreateWorld, a: string, b: string, c: string) {
    for (const dir of [a, b, c]) {
      assert.ok(statSync(join(this.buddyDir!, dir)).isDirectory(), `${dir} should be a directory`);
    }
  },
);

Then("the buddy directory contains the base templates", function (this: CreateWorld) {
  for (const file of [
    "AGENTS.md",
    "agent_brain/identity/SOUL.md",
    "agent_brain/identity/USER.md",
    "agent_brain/skills/.gitkeep",
  ]) {
    assert.ok(existsSync(join(this.buddyDir!, file)), `${file} should exist`);
  }
});

Then("USER.md contains the user's name and language", function (this: CreateWorld) {
  const copied = readFileSync(join(this.buddyDir!, "agent_brain/identity/USER.md"), "utf8");
  assert.match(copied, /\*\*Name:\*\* María/);
  assert.match(copied, /Software engineer in Madrid/);
  assert.match(copied, /Language: es/);
  assert.doesNotMatch(copied, /This section grows organically/);
});

Then(
  "{string} holds the configured provider and model",
  function (this: CreateWorld, relPath: string) {
    const settings = JSON.parse(readFileSync(join(this.buddyDir!, relPath), "utf8"));
    assert.deepEqual(settings, {
      defaultProvider: "anthropic",
      defaultModel: "claude-haiku-4-5",
    });
  },
);

Then(
  "the buddy directory is a git repository with exactly one commit",
  async function (this: CreateWorld) {
    const git = simpleGit(this.buddyDir!);
    const log = await git.log();
    assert.equal(log.total, 1);
    const status = await git.status();
    assert.equal(status.isClean(), true, "everything should be committed");
  },
);

Then("first-run detection reports the buddy as configured", function (this: CreateWorld) {
  const state = detectFirstRun(this.createConfigPath!);
  assert.equal(state.firstRun, false);
  if (!state.firstRun) assert.equal(state.config.rootDir, this.buddyDir);
});

Then("the buddy directory contains file {string}", function (this: CreateWorld, relPath: string) {
  assert.ok(existsSync(join(this.buddyDir!, relPath)), `${relPath} should exist`);
});

Then("{string} excludes {string}", function (this: CreateWorld, relPath: string, pattern: string) {
  const content = readFileSync(join(this.buddyDir!, relPath), "utf8");
  assert.match(content, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
});

Then("{string} declares text eol=lf", function (this: CreateWorld, relPath: string) {
  const content = readFileSync(join(this.buddyDir!, relPath), "utf8");
  assert.match(content, /eol\s*=\s*lf/i);
  assert.match(content, /^\*\s+text=auto\s+eol=lf/m);
});
