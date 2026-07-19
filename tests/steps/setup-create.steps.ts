// tests/steps/setup-create.steps.ts — FR-SETUP-06 deterministic AB creation.
// Real filesystem + real git on temp dirs; the repo's own templates/ are the
// fixture. No mocks, no network, no LLM.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";

import { createAbInstance, defaultTemplatesDir } from "../../backends/create-ab";
import { detectFirstRun } from "../../backends/setup";
import type { SetupConfig } from "../../shared/api";
import type { AbWorld } from "../support/world";

interface CreateWorld extends AbWorld {
  createTmpDir?: string;
  abDir?: string;
  createConfigPath?: string;
  setupConfig?: SetupConfig;
}

After(function (this: CreateWorld) {
  if (this.createTmpDir) rmSync(this.createTmpDir, { recursive: true, force: true });
});

Given("a completed wizard configuration", function (this: CreateWorld) {
  this.createTmpDir = mkdtempSync(join(tmpdir(), "ab-create-"));
  this.abDir = join(this.createTmpDir, "my-ab");
  this.createConfigPath = join(this.createTmpDir, "config.json");
  this.setupConfig = {
    abDirectory: this.abDir,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    language: "es",
    name: "María",
    about: "Software engineer in Madrid",
  };
});

When("setup runs", async function (this: CreateWorld) {
  await createAbInstance({
    config: this.setupConfig!,
    configPath: this.createConfigPath!,
    templatesDir: defaultTemplatesDir(),
  });
});

Then(
  "the AB directory contains {string}, {string} and {string}",
  function (this: CreateWorld, a: string, b: string, c: string) {
    for (const dir of [a, b, c]) {
      assert.ok(statSync(join(this.abDir!, dir)).isDirectory(), `${dir} should be a directory`);
    }
  },
);

Then("the AB directory contains the base templates", function (this: CreateWorld) {
  for (const file of [
    "AGENTS.md",
    "agent_brain/identity/SOUL.md",
    "agent_brain/identity/USER.md",
    "agent_brain/skills/triage-inbox.md",
  ]) {
    assert.ok(existsSync(join(this.abDir!, file)), `${file} should exist`);
  }
});

Then("USER.md contains the user's name and language", function (this: CreateWorld) {
  const copied = readFileSync(join(this.abDir!, "agent_brain/identity/USER.md"), "utf8");
  assert.match(copied, /\*\*Name:\*\* María/);
  assert.match(copied, /Software engineer in Madrid/);
  assert.match(copied, /Language: es/);
  assert.doesNotMatch(copied, /This section grows organically/);
});

Then(
  "{string} holds the configured provider and model",
  function (this: CreateWorld, relPath: string) {
    const settings = JSON.parse(readFileSync(join(this.abDir!, relPath), "utf8"));
    assert.deepEqual(settings, {
      defaultProvider: "anthropic",
      defaultModel: "claude-haiku-4-5",
    });
  },
);

Then(
  "the AB directory is a git repository with exactly one commit",
  async function (this: CreateWorld) {
    const git = simpleGit(this.abDir!);
    const log = await git.log();
    assert.equal(log.total, 1);
    const status = await git.status();
    assert.equal(status.isClean(), true, "everything should be committed");
  },
);

Then("first-run detection reports the AB as configured", function (this: CreateWorld) {
  const state = detectFirstRun(this.createConfigPath!);
  assert.equal(state.firstRun, false);
  if (!state.firstRun) assert.equal(state.config.abDirectory, this.abDir);
});
