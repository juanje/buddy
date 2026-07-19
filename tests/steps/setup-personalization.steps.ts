// tests/steps/setup-personalization.steps.ts — FR-SETUP-07 personalization.
// Deterministic layer: the interview instructions enter the prompt only
// while USER.md is a placeholder. The conversational behavior itself is
// LLM-driven and deliberately not tested here (no-token policy).

import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { defaultTemplatesDir } from "../../backends/create-ab";
import type { AssembledPrompt } from "../../backends/prompt";
import type { AbWorld } from "../support/world";

interface PersonalizationWorld extends AbWorld {
  abDir?: string;
  assembled?: AssembledPrompt;
}

Given("USER.md is still the placeholder template", function (this: PersonalizationWorld) {
  copyFileSync(
    join(defaultTemplatesDir(), "agent_brain", "identity", "USER.md"),
    join(this.abDir!, "agent_brain", "identity", "USER.md"),
  );
});

Given("USER.md already has the user's name filled in", function (this: PersonalizationWorld) {
  writeFileSync(
    join(this.abDir!, "agent_brain", "identity", "USER.md"),
    "# User profile\n\n## About\n\n- **Name:** Juanje\n- **What you do:** Engineering\n",
  );
});

Then("the prompt instructs the agent to introduce itself", function (this: PersonalizationWorld) {
  assert.equal(this.assembled!.personalizationPending, true);
  assert.match(this.assembled!.prompt, /# First conversation: initial setup/);
  assert.match(this.assembled!.prompt, /Greet them warmly/);
});

Then(
  "the prompt instructs the agent to ask for name, language, interests and preferences",
  function (this: PersonalizationWorld) {
    const prompt = this.assembled!.prompt;
    assert.match(prompt, /Their name/);
    assert.match(prompt, /language they prefer/);
    assert.match(prompt, /What they want to use you for/);
    assert.match(prompt, /How they like you to communicate/);
  },
);

Then(
  "the prompt instructs the agent to write the answers to USER.md as it learns them",
  function (this: PersonalizationWorld) {
    assert.match(this.assembled!.prompt, /agent_brain\/identity\/USER\.md/);
    assert.match(this.assembled!.prompt, /rewrite.*USER\.md completely/);
  },
);

Then("the prompt has no personalization instructions", function (this: PersonalizationWorld) {
  assert.equal(this.assembled!.personalizationPending, false);
  assert.doesNotMatch(this.assembled!.prompt, /# First conversation/);
});
