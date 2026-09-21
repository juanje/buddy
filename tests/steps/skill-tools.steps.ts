// tests/steps/skill-tools.steps.ts — FR-SKILL-01..03, FR-SKILL-06 skill tools BDD.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { bootRefreshIfNeeded } from "../../backends/boot-refresh";
import { computeBrainHealthReport, type BrainHealthReport } from "../../backends/brain-health";
import {
  buildLearnedSkillTools,
  buildSkillTools,
  executeSkillTool,
  skillToolNames,
} from "../../backends/skill-tools";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import type { BuddyWorld } from "../support/world";

interface SkillToolsWorld extends BuddyWorld {
  globalConfigDir?: string;
  buddyDir?: string;
  skillTools?: ToolDefinition[];
  lastToolResult?: string;
  brainHealthReport?: BrainHealthReport;
  lastLearnedSkillRelPath?: string;
}

After(function (this: SkillToolsWorld) {
  teardownGlobalConfigDir(this.globalConfigDir);
});

function requireBuddyDir(world: SkillToolsWorld): string {
  const dir = world.buddyDir;
  assert.ok(dir, "buddyDir must be set by an initialized buddy git repository");
  return dir;
}

function writeLearnedSkill(world: SkillToolsWorld, filename: string, content: string): void {
  const buddyDir = requireBuddyDir(world);
  const rel = join("agent_brain", "skills", filename);
  world.lastLearnedSkillRelPath = rel.replace(/\\/g, "/");
  const abs = join(buddyDir, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

function buildSessionSkillTools(world: SkillToolsWorld): ToolDefinition[] {
  assert.ok(world.globalConfigDir, "global config not initialized");
  const promptsDir = join(world.globalConfigDir, "prompts");
  const rootDir = requireBuddyDir(world);
  const core = buildSkillTools(promptsDir, { rootDir });
  const coreNames = new Set(skillToolNames(core));
  const learned = buildLearnedSkillTools(rootDir, coreNames);
  return [...core, ...learned];
}

Given("the app is running with skill tools", function (this: SkillToolsWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
  bootRefreshIfNeeded(this.globalConfigDir, "0.0.0-test");

  const promptsDir = join(this.globalConfigDir, "prompts");
  this.skillTools = buildSkillTools(promptsDir);
  assert.equal(this.skillTools.length, 1, "expected process_conversation skill tool");
});

Given("the app is running with skill tools including learned skills", function (this: SkillToolsWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
  bootRefreshIfNeeded(this.globalConfigDir, "0.0.0-test");
  this.skillTools = buildSessionSkillTools(this);
});

Given(
  "a learned skill file with tool_name {string} and tool_description {string}",
  function (this: SkillToolsWorld, toolName: string, toolDescription: string) {
    writeLearnedSkill(
      this,
      `${toolName}.md`,
      `---
summary: Learned skill for tests
tool_name: ${toolName}
tool_description: ${toolDescription}
created: 2026-09-21
---

## Procedure

1. Do the thing.
`,
    );
  },
);

Given("a learned skill file without tool_name", function (this: SkillToolsWorld) {
  writeLearnedSkill(
    this,
    "passive_skill.md",
    `---
summary: Passive skill without tool registration
created: 2026-09-21
---

## Procedure

1. Step one.
`,
  );
});

Given("a learned skill file with malformed frontmatter", function (this: SkillToolsWorld) {
  writeLearnedSkill(
    this,
    "broken-skill.md",
    `---
summary: Broken
tool_name: broken_skill
tool_description: Should not register
created: 2026-09-21
--- still open

## Procedure
`,
  );
});

When("brain health is computed", function (this: SkillToolsWorld) {
  this.brainHealthReport = computeBrainHealthReport(requireBuddyDir(this));
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

Then("the toolset does not contain {string}", function (this: SkillToolsWorld, toolName: string) {
  const names = skillToolNames(this.skillTools ?? []);
  assert.ok(!names.includes(toolName), `expected toolset not to contain ${toolName}, got ${names.join(", ")}`);
});

Then("no error is thrown during skill tool building", function () {
  // Building tools happens in the Given step; reaching here means no throw.
});

Then(
  "the brain health report flags incomplete skill frontmatter for the skill file",
  function (this: SkillToolsWorld) {
    const report = this.brainHealthReport;
    const rel = this.lastLearnedSkillRelPath;
    assert.ok(report, "brain health report missing");
    assert.ok(rel, "learned skill path missing");
    const entry = report.incompleteSkillFrontmatter.find((row) => row.path === rel);
    assert.ok(entry, `expected incomplete skill frontmatter for ${rel}`);
    assert.ok(entry.missing.includes("tool_name"));
  },
);
