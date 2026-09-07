// tests/steps/settings-tabs.steps.ts — FR-SETTINGS-08/09 Settings tab system.

import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "svelte/store";

import { t } from "../../src/lib/i18n";
import type { SettingsController } from "../../src/lib/settings-controller";
import type { BuddyWorld } from "../support/world";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

interface SettingsTabsWorld extends BuddyWorld {
  settings?: SettingsController;
}

function ensureSettings(this: SettingsTabsWorld): SettingsController {
  if (!this.settings) {
    throw new Error("Settings controller not initialized — use settings Background steps first");
  }
  return this.settings;
}

When("I switch to the integrations settings tab", function (this: SettingsTabsWorld) {
  ensureSettings.call(this).setActiveTab("integrations");
});

When("I switch to the general settings tab", function (this: SettingsTabsWorld) {
  ensureSettings.call(this).setActiveTab("general");
});

Then("the settings active tab is {string}", function (this: SettingsTabsWorld, tab: string) {
  const controller = ensureSettings.call(this);
  assert.equal(get(controller.activeTab), tab);
});

Then("the integrations tab shows the Jira panel", function (this: SettingsTabsWorld) {
  const controller = ensureSettings.call(this);
  assert.equal(get(controller.activeTab), "integrations");
  const src = readFileSync(join(ROOT, "src/lib/SettingsModal.svelte"), "utf8");
  assert.match(src, /JiraIntegrationPanel/);
  const strings = get(t);
  assert.ok(strings.settingsJiraTitle.length > 0);
});

Then("the settings version field is not shown", function () {
  const src = readFileSync(join(ROOT, "src/lib/SettingsModal.svelte"), "utf8");
  assert.doesNotMatch(src, /\$t\.settingsVersion/);
});

Then("integration panels are collapsed by default", function () {
  const src = readFileSync(join(ROOT, "src/lib/IntegrationSection.svelte"), "utf8");
  assert.match(src, /integration-section/);
  assert.match(src, /open\s*=\s*\$bindable\(false\)/);
});

Then("the integration section shows active and inactive status labels", function () {
  const modalSrc = readFileSync(join(ROOT, "src/lib/SettingsModal.svelte"), "utf8");
  assert.match(modalSrc, /IntegrationSection/);
  const sectionSrc = readFileSync(join(ROOT, "src/lib/IntegrationSection.svelte"), "utf8");
  assert.match(sectionSrc, /settingsIntegrationActive/);
  assert.match(sectionSrc, /settingsIntegrationInactive/);
  const strings = get(t);
  assert.ok(strings.settingsIntegrationActive.length > 0);
  assert.ok(strings.settingsIntegrationInactive.length > 0);
});
