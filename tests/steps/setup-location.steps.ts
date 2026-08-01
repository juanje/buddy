// tests/steps/setup-location.steps.ts — FR-SETUP-03 location picker.
// Controller drives the real location validator against per-scenario temp
// dirs (no mocks): the same code path the worker runs.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "svelte/store";

import { validateLocation } from "../../backends/location";
import type { SetupController } from "../../src/lib/setup-controller";
import { advanceToLocationStep } from "../support/setup-wizard-helpers";
import { wizardOf } from "../support/setup-wizard-factory";
import type { BuddyWorld } from "../support/world";

interface LocationWorld extends BuddyWorld {
  locTmpDir?: string;
  candidate?: string;
  wizard?: SetupController;
  existingInstanceDir?: string;
  emptyDir?: string;
  releaseSlowValidation?: () => void;
  slowValidationPath?: string;
}

const locationOverrides = (world: LocationWorld) => ({
  async getDefaultLocation() {
    return join(world.locTmpDir!, "buddy");
  },
  async validateLocation(path: string) {
    if (path === world.slowValidationPath) {
      await new Promise<void>((resolve) => {
        world.releaseSlowValidation = resolve;
      });
    }
    return validateLocation(path);
  },
});

After(function (this: LocationWorld) {
  if (this.locTmpDir) rmSync(this.locTmpDir, { recursive: true, force: true });
});

Given("the setup wizard is on the location step", async function (this: LocationWorld) {
  this.locTmpDir = mkdtempSync(join(tmpdir(), "buddy-location-"));
  await advanceToLocationStep(wizardOf(this, locationOverrides));
});

Given("the default location does not exist yet", async function (this: LocationWorld) {
  this.candidate = join(this.locTmpDir!, "buddy"); // never created
});

Given("an empty directory chosen by the user", function (this: LocationWorld) {
  this.candidate = join(this.locTmpDir!, "empty-choice");
  mkdirSync(this.candidate);
});

Given("a directory that already contains files", function (this: LocationWorld) {
  this.candidate = join(this.locTmpDir!, "busy");
  mkdirSync(this.candidate);
  writeFileSync(join(this.candidate, "notes.txt"), "existing content");
});

Given("a directory containing an existing buddy instance", function (this: LocationWorld) {
  this.candidate = join(this.locTmpDir!, "old-ab");
  mkdirSync(join(this.candidate, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(this.candidate, "agent_brain", "identity", "SOUL.md"), "# Soul\n");
  writeFileSync(join(this.candidate, "AGENTS.md"), "# Rules\n");
});

Given("a directory left behind by a failed setup", function (this: LocationWorld) {
  // agent_brain/ was created but the identity files never were.
  this.candidate = join(this.locTmpDir!, "half-created");
  mkdirSync(join(this.candidate, "agent_brain"), { recursive: true });
});

Given(
  "two candidate locations, one with an existing instance and one empty",
  function (this: LocationWorld) {
    this.existingInstanceDir = join(this.locTmpDir!, "old-instance");
    mkdirSync(join(this.existingInstanceDir, "agent_brain", "identity"), { recursive: true });
    writeFileSync(join(this.existingInstanceDir, "agent_brain", "identity", "SOUL.md"), "# Soul\n");
    writeFileSync(join(this.existingInstanceDir, "AGENTS.md"), "# Rules\n");

    this.emptyDir = join(this.locTmpDir!, "fresh-choice");
    mkdirSync(this.emptyDir);
  },
);

Given("validating the existing-instance directory is slow to resolve", function (this: LocationWorld) {
  this.slowValidationPath = this.existingInstanceDir;
});

When("the user accepts the proposed location", async function (this: LocationWorld) {
  await wizardOf(this, locationOverrides).pickLocation(this.candidate!);
});

When("the user picks that directory as the location", async function (this: LocationWorld) {
  await wizardOf(this, locationOverrides).pickLocation(this.candidate!);
});

When(
  "the user picks the existing-instance directory as the location",
  function (this: LocationWorld) {
    // Not awaited: this is the slow pick, deliberately left in flight so the
    // second pick below can race it.
    void wizardOf(this, locationOverrides).pickLocation(this.existingInstanceDir!);
  },
);

When(
  "the user picks the empty directory as the location before the first validation resolves",
  async function (this: LocationWorld) {
    await wizardOf(this, locationOverrides).pickLocation(this.emptyDir!);
  },
);

When(
  "the slow validation for the existing-instance directory resolves",
  async function (this: LocationWorld) {
    this.releaseSlowValidation?.();
    // Give the released microtask a turn to reach `locationCheck.set(...)`
    // before the assertions run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  },
);

Then("the location is stored for setup", function (this: LocationWorld) {
  assert.equal(get(wizardOf(this, locationOverrides).location), this.candidate);
});

Then("the location is rejected with a reason", function (this: LocationWorld) {
  const check = get(wizardOf(this, locationOverrides).locationCheck);
  assert.equal(check?.status, "not-empty");
});

Then("the wizard offers to import the existing instance", function (this: LocationWorld) {
  const check = get(wizardOf(this, locationOverrides).locationCheck);
  assert.equal(check?.status, "existing-buddy");
});

When("the user edits the location text", function (this: LocationWorld) {
  wizardOf(this, locationOverrides).locationInputChanged();
});

Then("the wizard no longer offers to import", function (this: LocationWorld) {
  assert.equal(get(wizardOf(this, locationOverrides).locationCheck), undefined);
});

Then(
  "importing is refused while no location has been validated",
  async function (this: LocationWorld) {
    await assert.rejects(() => wizardOf(this, locationOverrides).importExisting());
  },
);

Then("the location is stored as the empty directory", function (this: LocationWorld) {
  assert.equal(get(wizardOf(this, locationOverrides).location), this.emptyDir);
});

Then("the wizard reports it as unfinished, not importable", function (this: LocationWorld) {
  const check = get(wizardOf(this, locationOverrides).locationCheck);
  assert.equal(check?.status, "incomplete-buddy");
  assert.ok((check?.missing ?? []).length > 0, "should name what is missing");
});
