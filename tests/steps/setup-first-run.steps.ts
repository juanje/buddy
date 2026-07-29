// tests/steps/setup-first-run.steps.ts — FR-SETUP-01 first-run detection.
// Uses the real filesystem on a per-scenario temp dir (no mocks): the unit
// under test is exactly what the worker runs against ~/.buddy/config.json.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectFirstRun } from "../../backends/setup";
import { resolveInitialView, type AppView } from "../../src/lib/app-view";
import type { BuddyWorld } from "../support/world";

interface SetupWorld extends BuddyWorld {
  setupTmpDir?: string;
  configPath?: string;
  view?: AppView;
}

function freshConfigPath(world: SetupWorld): string {
  world.setupTmpDir = mkdtempSync(join(tmpdir(), "buddy-setup-"));
  world.configPath = join(world.setupTmpDir, "config.json");
  return world.configPath;
}

After(function (this: SetupWorld) {
  if (this.setupTmpDir) rmSync(this.setupTmpDir, { recursive: true, force: true });
});

Given("no buddy configuration file exists", function (this: SetupWorld) {
  freshConfigPath(this); // path allocated but never written
});

Given("a configuration file pointing to a buddy directory", function (this: SetupWorld) {
  const path = freshConfigPath(this);
  writeFileSync(
    path,
    JSON.stringify({ rootDir: join(this.setupTmpDir!, "buddy"), provider: "anthropic", model: "claude-haiku" }),
  );
});

Given("a configuration file without a buddy directory", function (this: SetupWorld) {
  const path = freshConfigPath(this);
  writeFileSync(path, JSON.stringify({ provider: "anthropic", model: "claude-haiku" }));
});

Given("a corrupted configuration file", function (this: SetupWorld) {
  const path = freshConfigPath(this);
  writeFileSync(path, "{ not valid json");
});

When("the app launches", function (this: SetupWorld) {
  // Same decision chain the real app runs: worker detects, frontend routes.
  const state = detectFirstRun(this.configPath!);
  this.view = resolveInitialView(state);
});

Then("the setup wizard is shown instead of the chat view", function (this: SetupWorld) {
  assert.equal(this.view, "setup");
});

Then("the chat view is shown", function (this: SetupWorld) {
  assert.equal(this.view, "chat");
});
