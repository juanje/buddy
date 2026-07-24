// tests/steps/cost-visibility.steps.ts — FR-COST-02/03 cost tracking and budget limits.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createUsageTracker,
  recordUsageToFile,
  type UsageTracker,
} from "../../backends/usage-tracker";
import type { AbWorld } from "../support/world";

interface CostWorld extends AbWorld {
  configDir?: string;
  tracker?: UsageTracker;
  monthlyBudget?: number | null;
}

function ensureDir(world: CostWorld): string {
  if (!world.configDir) {
    world.configDir = mkdtempSync(join(tmpdir(), "ab-cost-"));
  }
  return world.configDir;
}

function budgetFor(world: CostWorld): number | null {
  if (world.monthlyBudget === null) return null;
  if (world.monthlyBudget === undefined) return 10;
  return world.monthlyBudget;
}

function ensureTracker(world: CostWorld): UsageTracker {
  if (!world.tracker) {
    world.tracker = createUsageTracker(ensureDir(world), {
      getBudget: () => budgetFor(world),
    });
  }
  return world.tracker;
}

Given("a usage tracker with monthly budget {float}", function (this: CostWorld, budget: number) {
  this.monthlyBudget = budget;
  ensureTracker(this);
});

Given("the monthly budget is disabled", function (this: CostWorld) {
  this.monthlyBudget = null;
  this.tracker = createUsageTracker(ensureDir(this), {
    getBudget: () => budgetFor(this),
  });
});

Given("monthly usage already recorded as {float}", function (this: CostWorld, amount: number) {
  recordUsageToFile(ensureDir(this), { cost: amount, tokens: 100 });
});

When(
  "usage is recorded with cost {float} and {int} tokens",
  function (this: CostWorld, cost: number, tokens: number) {
    ensureTracker(this).record({ cost, tokens });
  },
);

When("a new usage tracker loads the usage file", function (this: CostWorld) {
  this.tracker = createUsageTracker(ensureDir(this), {
    getBudget: () => budgetFor(this),
  });
});

Then("the session total cost is {float}", function (this: CostWorld, expected: number) {
  assert.equal(ensureTracker(this).getUsageReport().session.totalCost, expected);
});

Then("the monthly total cost is {float}", function (this: CostWorld, expected: number) {
  assert.equal(ensureTracker(this).getUsageReport().monthly.totalCost, expected);
});

Then("the budget status level is {string}", function (this: CostWorld, level: string) {
  assert.equal(ensureTracker(this).getUsageReport().budget.level, level);
});

Then("sending is blocked by the budget limit", function (this: CostWorld) {
  assert.equal(ensureTracker(this).isBudgetExceeded(), true);
});

Then("sending is not blocked by the budget limit", function (this: CostWorld) {
  assert.equal(ensureTracker(this).isBudgetExceeded(), false);
});
