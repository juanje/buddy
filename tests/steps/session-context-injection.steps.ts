// tests/steps/session-context-injection.steps.ts — FR-PROMPT-02 session context.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleSessionContext, type SessionContext } from "../../backends/prompt";
import type { AbWorld } from "../support/world";

interface ContextWorld extends AbWorld {
  abDir?: string;
  sessionContext?: SessionContext;
}

const NOW = new Date("2026-07-19T10:00:00");

Given("the deferred queue has only an item due next month", function (this: ContextWorld) {
  writeFileSync(
    join(this.abDir!, "agent_brain", "deferred.md"),
    "- **reminder** (2026-08-15, user): Felicitar a mamá.\n",
  );
});

When("the session context is assembled", function (this: ContextWorld) {
  this.sessionContext = assembleSessionContext(this.abDir!, NOW);
});

Then("both deferred items are included as pending items to surface", function (this: ContextWorld) {
  const { message, dueItems } = this.sessionContext!;
  assert.equal(dueItems.length, 2);
  assert.match(message, /# Pending items to surface/);
  assert.match(message, /Llamar al dentista\./);
  assert.match(message, /Revisar notas de la semana\./);
});

Then("the session context has no pending items section", function (this: ContextWorld) {
  assert.equal(this.sessionContext!.dueItems.length, 0);
  assert.doesNotMatch(this.sessionContext!.message, /# Pending items to surface/);
});

Then("the session context message is non-empty", function (this: ContextWorld) {
  assert.notEqual(this.sessionContext!.message.trim(), "");
});

Then("the session context message is empty", function (this: ContextWorld) {
  assert.equal(this.sessionContext!.message.trim(), "");
});

Then("the session context includes the sessions index", function (this: ContextWorld) {
  assert.match(this.sessionContext!.message, /# Sessions index/);
  assert.match(this.sessionContext!.message, /Today work\./);
});

Then("the session context includes the last session log", function (this: ContextWorld) {
  assert.match(this.sessionContext!.message, /# Last session log/);
  assert.match(this.sessionContext!.message, /FR-PROMPT split/);
});
