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
}

const locationOverrides = (world: LocationWorld) => ({
  async getDefaultLocation() {
    return join(world.locTmpDir!, "buddy");
  },
  async validateLocation(path: string) {
    return validateLocation(path);
  },
});

After(function (this: LocationWorld) {
  if (this.locTmpDir) rmSync(this.locTmpDir, { recursive: true, force: true });
});

Given("the setup wizard is on the location step", async function (this: LocationWorld) {
  this.locTmpDir = mkdtempSync(join(tmpdir(), "ab-location-"));
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
  mkdirSync(join(this.candidate, "agent_brain"), { recursive: true });
});

When("the user accepts the proposed location", async function (this: LocationWorld) {
  await wizardOf(this, locationOverrides).pickLocation(this.candidate!);
});

When("the user picks that directory as the location", async function (this: LocationWorld) {
  await wizardOf(this, locationOverrides).pickLocation(this.candidate!);
});

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
