// tests/steps/setup-prereqs.steps.ts — FR-SETUP-02 prerequisites check.
// The wizard controller runs against a fake prerequisites source (no real
// binaries probed): scenarios control git availability explicitly.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { get } from "svelte/store";

import { createSetupController, type SetupController } from "../../src/lib/setup-controller";
import { advancePastIntroSteps } from "../support/setup-wizard-helpers";
import { gitInstallInstructions } from "../../src/lib/i18n";
import type { PrereqStatus } from "../../shared/api";
import { makeSetupWorkerFake } from "../support/setup-worker-fake";
import type { AbWorld } from "../support/world";

interface PrereqWorld extends AbWorld {
  gitInstalled?: boolean;
  wizard?: SetupController;
  instructions?: string;
}

function wizardOf(world: PrereqWorld): SetupController {
  if (!world.wizard) {
    world.wizard = createSetupController(
      makeSetupWorkerFake({
        async checkPrerequisites(): Promise<PrereqStatus> {
          return {
            gitInstalled: world.gitInstalled ?? true,
            gitVersion: world.gitInstalled ? "git version 2.44.0" : undefined,
            platform: "darwin",
          };
        },
      }),
    );
  }
  return world.wizard;
}

Given("the setup wizard has started", function (this: PrereqWorld) {
  advancePastIntroSteps(wizardOf(this));
});

Given("git is installed on the system", function (this: PrereqWorld) {
  this.gitInstalled = true;
});

Given("git is not installed on the system", function (this: PrereqWorld) {
  this.gitInstalled = false;
});

// Cucumber matches Given/When/And against the same expression pool, so one
// definition serves both phrasings across scenarios.
When("the prerequisites check runs", async function (this: PrereqWorld) {
  await wizardOf(this).checkPrerequisites();
});

When("git becomes available", function (this: PrereqWorld) {
  this.gitInstalled = true;
});

When("the user retries the prerequisites check", async function (this: PrereqWorld) {
  await wizardOf(this).checkPrerequisites();
});

Then("the wizard allows proceeding to the next step", function (this: PrereqWorld) {
  assert.equal(get(wizardOf(this).canProceed), true);
});

Then("the wizard does not allow proceeding", function (this: PrereqWorld) {
  assert.equal(get(wizardOf(this).canProceed), false);
});

Then("a message explains that git is required", function (this: PrereqWorld) {
  const prereq = get(wizardOf(this).prereq);
  assert.ok(prereq && !prereq.gitInstalled, "prereq status should report git missing");
});

Then("platform-specific install instructions are shown", function (this: PrereqWorld) {
  const prereq = get(wizardOf(this).prereq);
  assert.ok(prereq, "prereq status should be present");
  const instructions = gitInstallInstructions(prereq.platform);
  assert.ok(instructions.length > 0, "instructions must exist for the platform");
  assert.match(instructions, /brew|xcode-select/i); // darwin-specific content
});
