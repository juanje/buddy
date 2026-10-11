// tests/steps/data-consolidation.steps.ts — FR-DATA-05

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildConsolidationPrompt } from "../../backends/consolidation-runner";
import type { BuddyWorld } from "../support/world";
import { setupGlobalConfigDir } from "../support/global-config";

interface ConsolidationDataWorld extends BuddyWorld {
  buddyDir?: string;
  consolidationPrompt?: string;
  globalConfigDir?: string;
}

Given("buddy file {string} exists with content {string}", function (this: ConsolidationDataWorld, rel: string, content: string) {
  assert.ok(this.buddyDir);
  const abs = join(this.buddyDir, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
});

When(
  "the depth 1 consolidation prompt is built for {string}",
  async function (this: ConsolidationDataWorld, isoDay: string) {
    assert.ok(this.buddyDir);
    if (!this.globalConfigDir) {
      ({ configDir: this.globalConfigDir } = setupGlobalConfigDir({
        consolidationSkill: "# Skill\n\nDo consolidation.\n",
      }));
    }
    writeFileSync(join(this.buddyDir, "AGENTS.md"), "# Rules\n");
    this.consolidationPrompt = await buildConsolidationPrompt(
      this.buddyDir,
      1,
      new Date(`${isoDay}T12:00:00`),
    );
  },
);

Then("the consolidation prompt mentions {string}", function (this: ConsolidationDataWorld, fragment: string) {
  assert.ok(this.consolidationPrompt?.includes(fragment), this.consolidationPrompt);
});

Then("the consolidation prompt does not mention {string}", function (this: ConsolidationDataWorld, fragment: string) {
  assert.ok(!this.consolidationPrompt?.includes(fragment), this.consolidationPrompt);
});
