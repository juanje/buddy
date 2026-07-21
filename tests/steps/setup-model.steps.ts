// tests/steps/setup-model.steps.ts — FR-SETUP-05 model selection.
// Controller + curated catalog only: no worker calls, no network, no LLM.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "svelte/store";

import {
  createSetupController,
  type ProviderId,
  type SetupController,
} from "../../src/lib/setup-controller";
import { modelChoicesFor, recommendedModelFor } from "../../shared/model-catalog";
import { tierDescription } from "../../src/lib/i18n";
import { advanceToModelStep } from "../support/setup-wizard-helpers";
import { makeSetupWorkerFake } from "../support/setup-worker-fake";
import type { AbWorld } from "../support/world";

interface ModelWorld extends AbWorld {
  modelTmpDir?: string;
  wizard?: SetupController;
  modelProvider?: ProviderId;
  chosenModel?: string;
}

After(function (this: ModelWorld) {
  if (this.modelTmpDir) rmSync(this.modelTmpDir, { recursive: true, force: true });
});

async function wizardOnModelStep(world: ModelWorld, provider: ProviderId): Promise<void> {
  world.modelTmpDir = mkdtempSync(join(tmpdir(), "ab-model-step-"));
  world.modelProvider = provider;
  world.wizard = createSetupController(
    makeSetupWorkerFake({
      async validateLocation() {
        return { status: "ok-new" as const };
      },
      async configureProviderKey() {
        return { valid: true as const };
      },
    }),
  );
  await advanceToModelStep(world.wizard, world.modelTmpDir, provider);
}

Given(
  "the setup wizard is on the model step for the {string} provider",
  async function (this: ModelWorld, provider: string) {
    await wizardOnModelStep(this, provider as ProviderId);
  },
);

Then("the available models for the provider are listed", function (this: ModelWorld) {
  const choices = modelChoicesFor(this.modelProvider!);
  assert.ok(choices && choices.length >= 2, "curated catalog should offer choices");
});

Then("each model shows a tier description", function (this: ModelWorld) {
  for (const choice of modelChoicesFor(this.modelProvider!)!) {
    assert.ok(tierDescription(choice.tier).length > 0, `tier ${choice.tier} needs a description`);
  }
});

Then("the recommended model is preselected", function (this: ModelWorld) {
  const recommended = recommendedModelFor(this.modelProvider!);
  assert.ok(recommended, "provider should have a recommendation");
  assert.equal(get(this.wizard!.model), recommended.id);
});

When("the user selects another model from the list", function (this: ModelWorld) {
  const choices = modelChoicesFor(this.modelProvider!)!;
  const recommended = recommendedModelFor(this.modelProvider!)!;
  const other = choices.find((c) => c.id !== recommended.id)!;
  this.wizard!.selectModel(other.id);
  this.chosenModel = other.id;
});

When("the user types the model id {string}", function (this: ModelWorld, id: string) {
  this.wizard!.selectModel(id);
  this.chosenModel = id;
});

Then("the chosen model is stored for setup", function (this: ModelWorld) {
  assert.equal(get(this.wizard!.model), this.chosenModel);
});

Then("no model list is available for the provider", function (this: ModelWorld) {
  assert.equal(modelChoicesFor(this.modelProvider!), null);
  assert.equal(get(this.wizard!.model), undefined);
});
