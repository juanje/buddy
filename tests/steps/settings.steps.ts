// tests/steps/settings.steps.ts — FR-SETTINGS-02 Settings UI.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { get } from "svelte/store";

import type { SetupConfig } from "../../shared/api";
import { getLocale } from "../../src/lib/i18n";
import {
  createSettingsController,
  type SettingsController,
} from "../../src/lib/settings-controller";
import type { AbWorld } from "../support/world";

interface SettingsWorld extends AbWorld {
  appConfig: SetupConfig;
  settings?: SettingsController;
  updateConfigCalls: Array<Partial<Pick<SetupConfig, "language">>>;
}

const defaultConfig: SetupConfig = {
  abDirectory: "/tmp/buddy-test",
  provider: "anthropic",
  model: "claude-sonnet-5",
  language: "es",
};

function ensureSettings(this: SettingsWorld): SettingsController {
  if (!this.settings) {
    this.settings = createSettingsController({
      worker: {
        updateConfig: async (patch) => {
          this.updateConfigCalls.push(patch);
          this.appConfig = { ...this.appConfig, ...patch };
        },
      },
      getConfig: () => this.appConfig,
      onConfigChange: (config) => {
        this.appConfig = config;
      },
      version: "0.1.0",
    });
  }
  return this.settings;
}

Given("the app is configured with language {string}", function (this: SettingsWorld, language: string) {
  this.appConfig = { ...defaultConfig, language: language as SetupConfig["language"] };
  this.updateConfigCalls = [];
});

Given("the chat session is active", function (this: SettingsWorld) {
  this.connect();
});

When("I open settings", function (this: SettingsWorld) {
  ensureSettings.call(this).openSettings();
});

Given("the settings panel is open", function (this: SettingsWorld) {
  ensureSettings.call(this).openSettings();
});

When("I change the settings language to {string}", async function (this: SettingsWorld, language: string) {
  await ensureSettings.call(this).setLanguage(language as "es" | "en");
});

When("I close settings", function (this: SettingsWorld) {
  ensureSettings.call(this).closeSettings();
});

Then("the settings panel is visible", function (this: SettingsWorld) {
  assert.equal(get(ensureSettings.call(this).open), true);
});

Then("the settings panel is hidden", function (this: SettingsWorld) {
  assert.equal(get(ensureSettings.call(this).open), false);
});

Then("the settings show language {string}", function (this: SettingsWorld, language: string) {
  assert.equal(get(ensureSettings.call(this).config).language, language);
});

Then("the settings show provider {string}", function (this: SettingsWorld, provider: string) {
  assert.equal(get(ensureSettings.call(this).config).provider, provider);
});

Then("the settings show model {string}", function (this: SettingsWorld, model: string) {
  assert.equal(get(ensureSettings.call(this).config).model, model);
});

Then("the settings show directory {string}", function (this: SettingsWorld, directory: string) {
  assert.equal(get(ensureSettings.call(this).config).abDirectory, directory);
});

Then("the UI language is {string}", function (this: SettingsWorld, language: string) {
  assert.equal(getLocale(), language);
});

Then("the saved config language is {string}", function (this: SettingsWorld, language: string) {
  assert.equal(this.appConfig.language, language);
  assert.ok(this.updateConfigCalls.some((call) => call.language === language));
});
