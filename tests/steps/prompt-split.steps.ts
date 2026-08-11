// tests/steps/prompt-split.steps.ts — FR-PROMPT-08: AGENTS.md structural migration BDD steps.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGENTS_MD_BACKUP_REL,
  migrateAgentsMdIfNeeded,
} from "../../backends/brain-migration";
import { assembleSystemPrompt } from "../../backends/prompt";
import { setupGlobalConfigDir } from "../support/global-config";

interface PromptSplitWorld {
  buddyDir?: string;
  globalConfigDir?: string;
  agentsMdBefore?: string;
  systemPrompt?: string;
}

const OLD_AGENTS_MD = `# Buddy

## Core behavior

1. **Listen and capture:**
   - Actionable items → \`user/inbox.md\`

## Active context

### Right now
- **Scotland honeymoon:** logistics pending.

### Files

Promotion is gradual.

## Where to find things

- [Inbox](user/inbox.md) — tasks.

## Rules

1. **Language:** Reply in the user's language.
2. Don't read files preemptively — access on demand.
13. **Always use 24-hour time** for scheduling references.
14. **Never write to the journal during chat** — consolidation owns journal writes.
`;

const OLD_AGENTS_MD_MINIMAL = `# Buddy

## Core behavior

Capture everything.

## Active context

### Right now
- **Buddy documentation:** project index updated.

## Rules

1. **Language:** Reply in the user's language.
`;

function agentsMdPath(buddyDir: string): string {
  return join(buddyDir, "AGENTS.md");
}

function readAgentsMd(buddyDir: string): string {
  return readFileSync(agentsMdPath(buddyDir), "utf8");
}

Given("the new AGENTS.md template is deployed", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const template = readFileSync(join(process.cwd(), "templates", "AGENTS.md"), "utf8");
  writeFileSync(agentsMdPath(this.buddyDir), template);
});

Given("AGENTS.md in the old format with personalized active context", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  writeFileSync(agentsMdPath(this.buddyDir), OLD_AGENTS_MD_MINIMAL);
});

Given("AGENTS.md in the old format with two instance-learned rules", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  writeFileSync(agentsMdPath(this.buddyDir), OLD_AGENTS_MD);
});

Given("AGENTS.md already in the new format", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const template = readFileSync(join(process.cwd(), "templates", "AGENTS.md"), "utf8");
  writeFileSync(agentsMdPath(this.buddyDir), template);
  this.agentsMdBefore = template;
});

Given("agents-base.md with capture rules and core rules is deployed", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const agentsBase = readFileSync(
    join(process.cwd(), "bundled", "prompts", "agents-base.md"),
    "utf8",
  );
  setupGlobalConfigDir({ agentsBase });
  mkdirSync(join(this.buddyDir, "agent_brain", "identity"), { recursive: true });
  writeFileSync(
    join(this.buddyDir, "agent_brain", "identity", "USER.md"),
    "# User profile\n\n## About\n\n- **Name:** Test User\n",
  );
});

Given("AGENTS.md in the new format", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const template = readFileSync(join(process.cwd(), "templates", "AGENTS.md"), "utf8");
  writeFileSync(agentsMdPath(this.buddyDir), template);
});

When("migrateAgentsMd runs", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  migrateAgentsMdIfNeeded(this.buddyDir);
});

When("the system prompt is assembled for prompt split", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  this.systemPrompt = assembleSystemPrompt(this.buddyDir, new Date("2026-07-22T12:00:00Z")).prompt;
});

Then("AGENTS.md does not contain {string}", function (this: PromptSplitWorld, text: string) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const content = readAgentsMd(this.buddyDir);
  assert.ok(!content.includes(text), `AGENTS.md should not contain "${text}"`);
});

Then("AGENTS.md contains {string}", function (this: PromptSplitWorld, text: string) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const content = readAgentsMd(this.buddyDir);
  assert.ok(content.includes(text), `AGENTS.md should contain "${text}"`);
});

Then("AGENTS.md preserves the personalized right now bullet", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const content = readAgentsMd(this.buddyDir);
  assert.ok(content.includes("Buddy documentation"));
});

Then(
  "AGENTS.md Rules section contains {string}",
  function (this: PromptSplitWorld, text: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    const content = readAgentsMd(this.buddyDir);
    const rulesIndex = content.indexOf("## Rules");
    assert.ok(rulesIndex >= 0, "missing ## Rules section");
    const rulesSection = content.slice(rulesIndex);
    assert.ok(rulesSection.includes(text), `Rules section should contain "${text}"`);
  },
);

Then(
  "AGENTS.md Rules section does not contain {string}",
  function (this: PromptSplitWorld, text: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    const content = readAgentsMd(this.buddyDir);
    const rulesIndex = content.indexOf("## Rules");
    assert.ok(rulesIndex >= 0, "missing ## Rules section");
    const rulesSection = content.slice(rulesIndex);
    assert.ok(!rulesSection.includes(text), `Rules section should not contain "${text}"`);
  },
);

Then(
  "a backup exists at {string}",
  function (this: PromptSplitWorld, relPath: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    assert.ok(existsSync(join(this.buddyDir, relPath)), `expected backup at ${relPath}`);
  },
);

Then("the backup contains {string}", function (this: PromptSplitWorld, text: string) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const backup = readFileSync(join(this.buddyDir, AGENTS_MD_BACKUP_REL), "utf8");
  assert.ok(backup.includes(text), `backup should contain "${text}"`);
});

Then("AGENTS.md is unchanged", function (this: PromptSplitWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const content = readAgentsMd(this.buddyDir);
  assert.equal(content, this.agentsMdBefore);
});

Then(
  "the assembled system prompt contains {string}",
  function (this: PromptSplitWorld, text: string) {
    assert.ok(this.systemPrompt?.includes(text), `system prompt should contain "${text}"`);
  },
);
