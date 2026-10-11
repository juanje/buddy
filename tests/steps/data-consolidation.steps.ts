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

async function buildPromptForDepth(
  world: ConsolidationDataWorld,
  depth: number,
  isoDay: string,
): Promise<void> {
  assert.ok(world.buddyDir);
  if (!world.globalConfigDir) {
    ({ configDir: world.globalConfigDir } = setupGlobalConfigDir({
      consolidationSkill: "# Skill\n\nDo consolidation.\n",
    }));
  }
  writeFileSync(join(world.buddyDir, "AGENTS.md"), "# Rules\n");
  world.consolidationPrompt = await buildConsolidationPrompt(
    world.buddyDir,
    depth,
    new Date(`${isoDay}T12:00:00`),
  );
}

When(
  "the depth {int} consolidation prompt is built for {string}",
  async function (this: ConsolidationDataWorld, depth: number, isoDay: string) {
    await buildPromptForDepth(this, depth, isoDay);
  },
);

Given("dashboard file {string} with body:", function (this: ConsolidationDataWorld, rel: string, body: string) {
  assert.ok(this.buddyDir);
  const abs = join(this.buddyDir, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  const content = ["---", "type: dashboard", "title: Test", "summary: Test", "---", "", body.trim()].join("\n");
  writeFileSync(abs, content, "utf8");
});

Then("the consolidation prompt mentions {string}", function (this: ConsolidationDataWorld, fragment: string) {
  assert.ok(this.consolidationPrompt?.includes(fragment), this.consolidationPrompt);
});

Then("the consolidation prompt does not mention {string}", function (this: ConsolidationDataWorld, fragment: string) {
  assert.ok(!this.consolidationPrompt?.includes(fragment), this.consolidationPrompt);
});
