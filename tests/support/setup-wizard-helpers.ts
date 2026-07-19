// tests/support/setup-wizard-helpers.ts — navigate past intro wizard steps in BDD.
import assert from "node:assert/strict";
import { get } from "svelte/store";

import type { ProviderId, SetupController, SetupStep } from "../../src/lib/setup-controller";

export function advancePastIntroSteps(wizard: SetupController): void {
  wizard.selectLanguage("es");
  wizard.next(); // welcome
  wizard.setPersonalization("Test User");
  wizard.next(); // personalization → prerequisites
}

export function assertWizardStep(wizard: SetupController, step: SetupStep): void {
  assert.equal(get(wizard.step), step);
}

export async function advanceToLocationStep(wizard: SetupController): Promise<void> {
  advancePastIntroSteps(wizard);
  await wizard.checkPrerequisites();
  wizard.next();
  assertWizardStep(wizard, "location");
}

export async function advanceToProviderStep(
  wizard: SetupController,
  location: string,
): Promise<void> {
  await advanceToLocationStep(wizard);
  await wizard.pickLocation(location);
  wizard.next();
  assertWizardStep(wizard, "provider");
}

export async function advanceToModelStep(
  wizard: SetupController,
  location: string,
  provider: ProviderId,
): Promise<void> {
  await advanceToProviderStep(wizard, location);
  wizard.selectProvider(provider);
  await wizard.submitApiKey(
    "valid-key",
    provider === "custom" ? "http://localhost/v1" : undefined,
  );
  wizard.next();
  assertWizardStep(wizard, "model");
}
