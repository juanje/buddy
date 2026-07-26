// tests/steps/prompt-refresh.steps.ts — NFR-MIGRATE-06 BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { bootRefreshIfNeeded } from "../../backends/boot-refresh";
import { bundledDocsDir, bundledPromptsDir } from "../../backends/deploy-bundled-content";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import type { BuddyWorld } from "../support/world";

interface PromptRefreshWorld extends BuddyWorld {
  globalConfigDir?: string;
  appVersion?: string;
  promptsBeforeRefresh?: string;
}

After(function (this: PromptRefreshWorld) {
  teardownGlobalConfigDir(this.globalConfigDir);
});

Given("a global config directory", function (this: PromptRefreshWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
});

Given(/^config\.json has last_app_version "(.*)"$/, function (this: PromptRefreshWorld, version: string) {
  const configPath = join(this.globalConfigDir!, "config.json");
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  }
  config.last_app_version = version;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
});

Given("config.json does not exist", function (this: PromptRefreshWorld) {
  const configPath = join(this.globalConfigDir!, "config.json");
  if (existsSync(configPath)) rmSync(configPath);
});

Given("the current app version is {string}", function (this: PromptRefreshWorld, version: string) {
  this.appVersion = version;
});

When("the boot sequence runs boot refresh", function (this: PromptRefreshWorld) {
  const promptsDir = join(this.globalConfigDir!, "prompts");
  const promptsPath = join(promptsDir, "agents-base.md");
  mkdirSync(promptsDir, { recursive: true });
  this.promptsBeforeRefresh = existsSync(promptsPath)
    ? readFileSync(promptsPath, "utf8")
    : "# stale prompt content\n";
  writeFileSync(promptsPath, "# stale prompt content\n", "utf8");
  bootRefreshIfNeeded(this.globalConfigDir!, this.appVersion!);
});

Then("all bundled prompts are copied to the global prompts directory", function (this: PromptRefreshWorld) {
  const bundledAgentsBase = readFileSync(join(bundledPromptsDir(), "agents-base.md"), "utf8");
  const installed = readFileSync(join(this.globalConfigDir!, "prompts", "agents-base.md"), "utf8");
  assert.equal(installed, bundledAgentsBase);
  assert.ok(existsSync(join(this.globalConfigDir!, "prompts", "consolidation.md")));
  assert.ok(existsSync(join(this.globalConfigDir!, "prompts", "process-conversation.md")));
});

Then("all bundled docs are copied to the global docs directory", function (this: PromptRefreshWorld) {
  const bundledIndex = readFileSync(join(bundledDocsDir(), "index.md"), "utf8");
  const installed = readFileSync(join(this.globalConfigDir!, "docs", "index.md"), "utf8");
  assert.equal(installed, bundledIndex);
  assert.ok(existsSync(join(this.globalConfigDir!, "docs", "capabilities.md")));
});

Then(/^config\.json should have last_app_version "(.*)"$/, function (this: PromptRefreshWorld, version: string) {
  const config = JSON.parse(readFileSync(join(this.globalConfigDir!, "config.json"), "utf8")) as {
    last_app_version?: string;
  };
  assert.equal(config.last_app_version, version);
});

Then("prompts directory is unchanged", function (this: PromptRefreshWorld) {
  const current = readFileSync(join(this.globalConfigDir!, "prompts", "agents-base.md"), "utf8");
  assert.equal(current, "# stale prompt content\n");
});
