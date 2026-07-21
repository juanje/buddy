// tests/steps/prompt-assembly.steps.ts — FR-PROMPT-01/02 prompt assembly.
// Real files on temp dirs; deterministic clock. No mocks, no LLM.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assembleSystemPrompt, type AssembledPrompt } from "../../backends/prompt";
import type { AbWorld } from "../support/world";

interface PromptWorld extends AbWorld {
  promptTmpDir?: string;
  abDir?: string;
  assembled?: AssembledPrompt;
}

// Fixed "now" so due/overdue/future are deterministic.
const NOW = new Date("2026-07-19T10:00:00");

After(function (this: PromptWorld) {
  if (this.promptTmpDir) rmSync(this.promptTmpDir, { recursive: true, force: true });
});

Given("an AB directory with identity files", function (this: PromptWorld) {
  this.promptTmpDir = mkdtempSync(join(tmpdir(), "ab-prompt-"));
  this.abDir = join(this.promptTmpDir, "buddy");
  mkdirSync(join(this.abDir, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(this.abDir, "AGENTS.md"), "# Behavioral rules\n\nAlways be kind.\n");
  writeFileSync(
    join(this.abDir, "agent_brain", "identity", "SOUL.md"),
    "# Soul\n\nCurious and warm.\n",
  );
  writeFileSync(
    join(this.abDir, "agent_brain", "identity", "USER.md"),
    "# User profile\n\n## About\n\n- **Name:** Juanje\n",
  );
});

Given(
  "the deferred queue has an item due today and an overdue item",
  function (this: PromptWorld) {
    writeFileSync(
      join(this.abDir!, "agent_brain", "deferred.md"),
      [
        "# Deferred queue",
        "",
        "- **reminder** (2026-07-19, user): Llamar al dentista.",
        "- **review** (2026-07-01, weekly): Revisar notas de la semana.",
      ].join("\n"),
    );
  },
);

Given("the deferred queue has only an item due next month", function (this: PromptWorld) {
  writeFileSync(
    join(this.abDir!, "agent_brain", "deferred.md"),
    "- **reminder** (2026-08-15, user): Felicitar a mamá.\n",
  );
});

Given("the AB directory has no USER.md", function (this: PromptWorld) {
  unlinkSync(join(this.abDir!, "agent_brain", "identity", "USER.md"));
});

Given("the AB directory has CLAUDE.md instead of AGENTS.md", function (this: PromptWorld) {
  const agentsPath = join(this.abDir!, "AGENTS.md");
  const claudePath = join(this.abDir!, "CLAUDE.md");
  writeFileSync(claudePath, "# Cursor rules\n\nFrom Claude file.\n");
  unlinkSync(agentsPath);
});

Given("the AB directory has neither AGENTS.md nor CLAUDE.md", function (this: PromptWorld) {
  const agentsPath = join(this.abDir!, "AGENTS.md");
  const claudePath = join(this.abDir!, "CLAUDE.md");
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
  this.assembled = assembleSystemPrompt(this.abDir!, NOW);
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
  assert.ok(this.assembled!.prompt.includes(NOW.toISOString()));
});

Then("both deferred items are included as pending items to surface", function (this: PromptWorld) {
  const { prompt, dueItems } = this.assembled!;
  assert.equal(dueItems.length, 2);
  assert.match(prompt, /# Pending items to surface/);
  assert.match(prompt, /Llamar al dentista\./);
  assert.match(prompt, /Revisar notas de la semana\./);
});

Then("the prompt has no pending items section", function (this: PromptWorld) {
  assert.equal(this.assembled!.dueItems.length, 0);
  assert.doesNotMatch(this.assembled!.prompt, /# Pending items to surface/);
});

Then("the prompt has no user profile section", function (this: PromptWorld) {
  assert.doesNotMatch(this.assembled!.prompt, /# About your user/);
});
