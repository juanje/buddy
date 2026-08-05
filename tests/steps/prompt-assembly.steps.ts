// tests/steps/prompt-assembly.steps.ts — FR-PROMPT-01 prompt assembly.
// Real files on temp dirs; deterministic clock. No mocks, no LLM.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assembleSystemPrompt, type AssembledPrompt } from "../../backends/prompt";
import type { BuddyWorld } from "../support/world";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

interface PromptWorld extends BuddyWorld {
  promptTmpDir?: string;
  globalConfigDir?: string;
  buddyDir?: string;
  assembled?: AssembledPrompt;
}

const NOW = new Date("2026-07-19T10:00:00");

After(function (this: PromptWorld) {
  teardownGlobalConfigDir(this.globalConfigDir);
  if (this.promptTmpDir) rmSync(this.promptTmpDir, { recursive: true, force: true });
});

Given("a buddy directory with identity files", function (this: PromptWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
  this.promptTmpDir = mkdtempSync(join(tmpdir(), "buddy-prompt-"));
  this.buddyDir = join(this.promptTmpDir, "buddy");
  mkdirSync(join(this.buddyDir, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(this.buddyDir, "AGENTS.md"), "# Behavioral rules\n\nAlways be kind.\n");
  writeFileSync(
    join(this.buddyDir, "agent_brain", "identity", "SOUL.md"),
    "# Soul\n\nCurious and warm.\n",
  );
  writeFileSync(
    join(this.buddyDir, "agent_brain", "identity", "USER.md"),
    "# User profile\n\n## About\n\n- **Name:** Juanje\n",
  );
});

Given(
  "the deferred queue has an item due today and an overdue item",
  function (this: PromptWorld) {
    writeFileSync(
      join(this.buddyDir!, "agent_brain", "deferred.md"),
      [
        "# Deferred queue",
        "",
        "- **reminder** (2026-07-19, user): Llamar al dentista.",
        "- **review** (2026-07-01, weekly): Revisar notas de la semana.",
      ].join("\n"),
    );
  },
);

Given("the buddy directory has session logs", function (this: PromptWorld) {
  mkdirSync(join(this.buddyDir!, "logs"), { recursive: true });
  writeFileSync(
    join(this.buddyDir!, "logs", "index.md"),
    [
      "# Sessions index",
      "",
      "- 2026-07-18: active — Prior day.",
      "- 2026-07-19: active — Today work.",
    ].join("\n"),
  );
  writeFileSync(
    join(this.buddyDir!, "logs", "2026-07-19.md"),
    "## Session 09:00–10:00\n\n### Context\n\nShipped FR-PROMPT split.\n",
  );
});

Given("the buddy directory has no USER.md", function (this: PromptWorld) {
  unlinkSync(join(this.buddyDir!, "agent_brain", "identity", "USER.md"));
});

Given("the buddy directory has CLAUDE.md instead of AGENTS.md", function (this: PromptWorld) {
  const agentsPath = join(this.buddyDir!, "AGENTS.md");
  const claudePath = join(this.buddyDir!, "CLAUDE.md");
  writeFileSync(claudePath, "# Cursor rules\n\nFrom Claude file.\n");
  unlinkSync(agentsPath);
});

Given("the buddy directory has neither AGENTS.md nor CLAUDE.md", function (this: PromptWorld) {
  const agentsPath = join(this.buddyDir!, "AGENTS.md");
  const claudePath = join(this.buddyDir!, "CLAUDE.md");
  try {
    unlinkSync(agentsPath);
  } catch {
    // already absent
  }
  try {
    unlinkSync(claudePath);
  } catch {
    // already absent
  }
});

When("the system prompt is assembled", function (this: PromptWorld) {
  this.assembled = assembleSystemPrompt(this.buddyDir!, NOW);
});

Then("it contains the AGENTS.md rules", function (this: PromptWorld) {
  assert.match(this.assembled!.prompt, /Always be kind\./);
});

Then("it contains the CLAUDE.md rules", function (this: PromptWorld) {
  assert.match(this.assembled!.prompt, /From Claude file\./);
});

Then("the prompt has no rules section", function (this: PromptWorld) {
  assert.doesNotMatch(this.assembled!.prompt, /Always be kind\./);
  assert.doesNotMatch(this.assembled!.prompt, /From Claude file\./);
});

Then("it contains the SOUL.md character definition", function (this: PromptWorld) {
  assert.match(this.assembled!.prompt, /Curious and warm\./);
});

Then("it contains the USER.md profile", function (this: PromptWorld) {
  assert.match(this.assembled!.prompt, /\*\*Name:\*\* Juanje/);
});

Then("it contains the current date and time", function (this: PromptWorld) {
  assert.match(this.assembled!.prompt, /# Current date and time/);
  assert.match(this.assembled!.prompt, /Sunday, 19 July 2026/);
});

Then("the prompt has no pending items section", function (this: PromptWorld) {
  assert.doesNotMatch(this.assembled!.prompt, /# Pending items to surface/);
});

Then("the prompt has no sessions index section", function (this: PromptWorld) {
  assert.doesNotMatch(this.assembled!.prompt, /# Sessions index/);
});

Then("the prompt has no last session log section", function (this: PromptWorld) {
  assert.doesNotMatch(this.assembled!.prompt, /# Last session log/);
});

Then("the prompt has no user profile section", function (this: PromptWorld) {
  assert.doesNotMatch(this.assembled!.prompt, /# About your user/);
});

Then("the system prompt has no personalization instructions", function (this: PromptWorld) {
  const { prompt } = this.assembled ?? assembleSystemPrompt(this.buddyDir!, NOW);
  assert.doesNotMatch(prompt, /# First conversation/);
});
