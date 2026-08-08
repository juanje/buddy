// tests/steps/edit-recovery.steps.ts — FR-GUARD-02 BDD steps.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  enrichEditToolResult,
  extractToolResultText,
  installEditRecoveryHook,
} from "../../backends/edit-recovery";
import { bundledPromptsDir } from "../../backends/deploy-bundled-content";

interface EditRecoveryWorld {
  errorMessage?: string;
  toolName?: string;
  enrichedText?: string;
  originalText?: string;
  maintenanceResult?: string;
}

After(function (this: EditRecoveryWorld) {
  // no temp dirs
});

When(
  "an edit tool fails with message {string}",
  function (this: EditRecoveryWorld, message: string) {
    this.toolName = "edit";
    this.errorMessage = message;
    this.originalText = message;
    const enriched = enrichEditToolResult({
      content: [{ type: "text", text: message }],
    });
    this.enrichedText = enriched
      ? extractToolResultText(enriched)
      : message;
  },
);

When(
  "a read tool fails with message {string}",
  function (this: EditRecoveryWorld, message: string) {
    this.toolName = "read";
    this.errorMessage = message;
    this.enrichedText = message;
  },
);

Then("the enriched result includes {string}", function (this: EditRecoveryWorld, fragment: string) {
  assert.ok(
    this.enrichedText?.includes(fragment),
    `expected enriched result to include "${fragment}", got: ${this.enrichedText}`,
  );
});

Then("the enriched result is unchanged", function (this: EditRecoveryWorld) {
  assert.equal(this.enrichedText, this.originalText ?? this.errorMessage);
});

Given("a maintenance session with edit recovery installed", function (this: EditRecoveryWorld) {
  this.toolName = "edit";
});

When(
  "an edit call fails with message {string}",
  function (this: EditRecoveryWorld, message: string) {
    const session = { agent: {} };
    installEditRecoveryHook(session);
    const after = (session.agent as { afterToolCall: (ctx: unknown) => Promise<unknown> })
      .afterToolCall;

    const ctx = {
      toolCall: { name: "edit" },
      args: { path: "agent_brain/deferred.md" },
      result: { content: [{ type: "text", text: message }] },
      isError: true,
    };

    return after(ctx).then(() => {
      this.maintenanceResult = extractToolResultText(ctx.result);
    });
  },
);

Then(
  "the maintenance hook enriches the result with {string}",
  function (this: EditRecoveryWorld, fragment: string) {
    assert.ok(
      this.maintenanceResult?.includes(fragment),
      `expected maintenance result to include "${fragment}", got: ${this.maintenanceResult}`,
    );
  },
);

Then("agents-base.md contains edit recovery guidance", function () {
  const base = readFileSync(join(bundledPromptsDir(), "agents-base.md"), "utf8");
  assert.match(base, /When edit fails/i);
  assert.match(base, /Never fall back to `write`/i);
  assert.match(base, /re-read/i);
});
