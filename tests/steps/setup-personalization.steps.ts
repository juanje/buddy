// tests/steps/setup-personalization.steps.ts — FR-SETUP-07 personalization.
// Deterministic layer: the interview instructions enter session context only
// while USER.md is a placeholder. The conversational behavior itself is
// LLM-driven and deliberately not tested here (no-token policy).

import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { defaultTemplatesDir } from "../../backends/create-buddy";
import type { SessionContext } from "../../backends/prompt";
import type { AbWorld } from "../support/world";

interface PersonalizationWorld extends AbWorld {
  abDir?: string;
  sessionContext?: SessionContext;
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

Then(
  "the session context instructs the agent to introduce itself",
  function (this: PersonalizationWorld) {
    assert.equal(this.sessionContext!.personalizationPending, true);
    assert.match(this.sessionContext!.message, /# First conversation: initial setup/);
    assert.match(this.sessionContext!.message, /Greet them warmly/);
  },
);

Then(
  "the session context instructs the agent to ask for name, language, interests and preferences",
  function (this: PersonalizationWorld) {
    const message = this.sessionContext!.message;
    assert.match(message, /Their name/);
    assert.match(message, /language they prefer/);
    assert.match(message, /What they want to use you for/);
    assert.match(message, /How they like you to communicate/);
  },
);

Then(
  "the session context instructs the agent to write the answers to USER.md as it learns them",
  function (this: PersonalizationWorld) {
    assert.match(this.sessionContext!.message, /agent_brain\/identity\/USER\.md/);
    assert.match(this.sessionContext!.message, /rewrite.*USER\.md completely/);
  },
);

Then(
  "the session context has no personalization instructions",
  function (this: PersonalizationWorld) {
    assert.equal(this.sessionContext!.personalizationPending, false);
    assert.doesNotMatch(this.sessionContext!.message, /# First conversation/);
  },
);
