// tests/steps/prompt-refresh.steps.ts — NFR-MIGRATE-06 BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { refreshPromptsIfNeeded } from "../../backends/prompt-refresh";
import { ensureSchema } from "../../backends/schema-migration";
import { bundledPromptsDir } from "../../backends/migrations/migrate-0-to-1";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import type { AbWorld } from "../support/world";

interface PromptRefreshWorld extends AbWorld {
  globalConfigDir?: string;
  appVersion?: string;
  promptsBeforeRefresh?: string;
}

After(function (this: PromptRefreshWorld) {
  teardownGlobalConfigDir(this.globalConfigDir);
});

Given("a global config directory with schema version 1", function (this: PromptRefreshWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
  ensureSchema(this.globalConfigDir);
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

When("the boot sequence runs prompt refresh", function (this: PromptRefreshWorld) {
  const promptsDir = join(this.globalConfigDir!, "prompts", "agents-base.md");
  if (existsSync(promptsDir)) {
    this.promptsBeforeRefresh = readFileSync(promptsDir, "utf8");
    writeFileSync(promptsDir, "# stale prompt content\n", "utf8");
  }
  refreshPromptsIfNeeded(this.globalConfigDir!, this.appVersion!);
});

Then("all bundled prompts are copied to the global prompts directory", function (this: PromptRefreshWorld) {
  const bundledAgentsBase = readFileSync(join(bundledPromptsDir(), "agents-base.md"), "utf8");
  const installed = readFileSync(join(this.globalConfigDir!, "prompts", "agents-base.md"), "utf8");
  assert.equal(installed, bundledAgentsBase);
  assert.ok(existsSync(join(this.globalConfigDir!, "prompts", "consolidation.md")));
  assert.ok(existsSync(join(this.globalConfigDir!, "prompts", "process-conversation.md")));
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
