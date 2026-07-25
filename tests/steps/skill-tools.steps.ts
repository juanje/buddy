// tests/steps/skill-tools.steps.ts — FR-SKILL-01..03 skill tools BDD.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { join } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { ensureSchema } from "../../backends/schema-migration";
import { buildSkillTools, executeSkillTool } from "../../backends/skill-tools";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import type { AbWorld } from "../support/world";

interface SkillToolsWorld extends AbWorld {
  globalConfigDir?: string;
  skillTools?: ToolDefinition[];
  lastToolResult?: string;
}

After(function (this: SkillToolsWorld) {
  teardownGlobalConfigDir(this.globalConfigDir);
});

Given("the app is running with skill tools", function (this: SkillToolsWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
  ensureSchema(this.globalConfigDir);

  const promptsDir = join(this.globalConfigDir, "prompts");
  this.skillTools = buildSkillTools(promptsDir);
  assert.equal(this.skillTools.length, 2, "expected both skill tools to be registered");
});

When('the LLM invokes the {string} tool', async function (this: SkillToolsWorld, toolName: string) {
  this.lastToolResult = await executeSkillTool(this.skillTools!, toolName);
});

Then("the tool result contains {string}", function (this: SkillToolsWorld, expected: string) {
  assert.ok(
    this.lastToolResult?.includes(expected),
    `expected tool result to contain ${expected}`,
  );
});
