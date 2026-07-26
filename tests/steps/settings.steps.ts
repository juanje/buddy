// tests/steps/settings.steps.ts — FR-SETTINGS-02/03 Settings UI.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { get } from "svelte/store";

import type { SetupConfig, UsageReport } from "../../shared/api";
import { getLocale } from "../../src/lib/i18n";
import {
  createSettingsController,
  type SettingsController,
  type SettingsWorkerAPI,
} from "../../src/lib/settings-controller";
import {
  buildMockWorker,
  DEFAULT_TEST_CONFIG,
} from "../support/settings-fixtures";
import type { BuddyWorld } from "../support/world";

interface SettingsWorld extends BuddyWorld {
  appConfig: SetupConfig;
  settings?: SettingsController;
  updateConfigCalls: Array<Partial<Pick<SetupConfig, "language" | "monthlyBudget">>>;
  changeModelCalls: Array<{ provider: SetupConfig["provider"]; model: string }>;
  oauthLoginCalls: SetupConfig["provider"][];
  authedProviders: Set<SetupConfig["provider"]>;
  usageReport?: UsageReport;
}

const defaultConfig: SetupConfig = DEFAULT_TEST_CONFIG;

function buildWorker(this: SettingsWorld): SettingsWorkerAPI {
  return buildMockWorker({
    getUsage: async () =>
      this.usageReport ?? {
        session: { totalCost: 0, totalTokens: 0, messageCount: 0 },
        monthly: { totalCost: 0, totalTokens: 0, messageCount: 0 },
        budget: { level: "ok", percent: 0, remaining: 10, budget: 10, monthlyCost: 0 },
      },
    updateConfig: async (patch) => {
      this.updateConfigCalls.push(patch);
      this.appConfig = { ...this.appConfig, ...patch };
    },
    changeModel: async (provider, model) => {
      this.changeModelCalls.push({ provider, model });
      this.appConfig = { ...this.appConfig, provider, model };
    },
    getAuthStatus: async () => ({
      providers: [
        {
          piProviderId: "anthropic",
          buddyProvider: "anthropic",
          hasAuth: this.authedProviders.has("anthropic"),
        },
        {
          piProviderId: "openai-codex",
          buddyProvider: "openai",
          hasAuth: this.authedProviders.has("openai"),
        },
        {
          piProviderId: "google",
          buddyProvider: "google",
          hasAuth: this.authedProviders.has("google"),
        },
      ],
    }),
    loginOAuth: async (provider) => {
      this.oauthLoginCalls.push(provider);
      this.authedProviders.add(provider);
      return { success: true };
    },
  });
}

function ensureSettings(this: SettingsWorld): SettingsController {
  if (!this.appConfig) {
    this.appConfig = { ...defaultConfig };
    this.updateConfigCalls = [];
    this.changeModelCalls = [];
    this.oauthLoginCalls = [];
    this.authedProviders = new Set(["anthropic"]);
  }
  if (!this.settings) {
    this.settings = createSettingsController({
      worker: buildWorker.call(this),
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
  this.changeModelCalls = [];
  this.oauthLoginCalls = [];
  this.authedProviders = new Set(["anthropic"]);
});

Given("the chat session is active", function (this: SettingsWorld) {
  this.connect();
});

When("I open settings", async function (this: SettingsWorld) {
  ensureSettings.call(this).openSettings();
  await new Promise((r) => setTimeout(r, 0));
});

Given("the settings panel is open", async function (this: SettingsWorld) {
  ensureSettings.call(this).openSettings();
  await new Promise((r) => setTimeout(r, 0));
});

When("I change the settings language to {string}", async function (this: SettingsWorld, language: string) {
  await ensureSettings.call(this).setLanguage(language as "es" | "en");
});

When("I change the settings model to {string}", async function (this: SettingsWorld, model: string) {
  const controller = ensureSettings.call(this);
  const provider = get(controller.config).provider;
  await controller.setModel(provider, model);
});

When("I add provider {string} in settings", async function (this: SettingsWorld, provider: string) {
  const controller = ensureSettings.call(this);
  controller.startAddProvider();
  controller.selectAuthProvider(provider as SetupConfig["provider"]);
  await controller.submitAuthOAuth();
});

When("I switch settings model to {string} on provider {string}", async function (
  this: SettingsWorld,
  model: string,
  provider: string,
) {
  await ensureSettings.call(this).setModel(provider as SetupConfig["provider"], model);
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
  assert.equal(get(ensureSettings.call(this).config).rootDir, directory);
});

Then("the UI language is {string}", function (this: SettingsWorld, language: string) {
  assert.equal(getLocale(), language);
});

Then("the saved config language is {string}", function (this: SettingsWorld, language: string) {
  assert.equal(this.appConfig.language, language);
  assert.ok(this.updateConfigCalls.some((call) => call.language === language));
});

Then("changeModel was called with provider {string} and model {string}", function (
  this: SettingsWorld,
  provider: string,
  model: string,
) {
  assert.ok(
    this.changeModelCalls.some((call) => call.provider === provider && call.model === model),
  );
});

Then("the settings model list includes {string}", async function (this: SettingsWorld, modelId: string) {
  const controller = ensureSettings.call(this);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(get(controller.models).some((m) => m.id === modelId));
});

Then("provider {string} was authenticated in settings", function (this: SettingsWorld, provider: string) {
  assert.ok(this.oauthLoginCalls.includes(provider as SetupConfig["provider"]));
});

Given(
  "usage summary session cost {float} and monthly cost {float} with budget {float}",
  function (this: SettingsWorld, sessionCost: number, monthlyCost: number, budget: number) {
    this.usageReport = {
      session: { totalCost: sessionCost, totalTokens: 0, messageCount: 0 },
      monthly: { totalCost: monthlyCost, totalTokens: 0, messageCount: 1 },
      budget: {
        level: monthlyCost >= budget ? "exceeded" : monthlyCost >= budget * 0.8 ? "warning" : "ok",
        percent: (monthlyCost / budget) * 100,
        remaining: Math.max(0, budget - monthlyCost),
        budget,
        monthlyCost,
      },
    };
    this.appConfig = { ...this.appConfig, monthlyBudget: budget };
  },
);

Then("the settings show session cost {string}", function (this: SettingsWorld, amount: string) {
  const usage = get(ensureSettings.call(this).usage);
  assert.ok(usage);
  assert.equal(usage.session.totalCost.toFixed(2), amount);
});

Then("the settings show monthly cost {string}", function (this: SettingsWorld, amount: string) {
  const usage = get(ensureSettings.call(this).usage);
  assert.ok(usage);
  assert.equal(usage.monthly.totalCost.toFixed(2), amount);
});

Then("the settings show monthly budget {string}", function (this: SettingsWorld, amount: string) {
  const config = get(ensureSettings.call(this).config);
  assert.equal(config.monthlyBudget?.toFixed(2), amount);
});

When("I set the monthly budget to {string}", async function (this: SettingsWorld, amount: string) {
  await ensureSettings.call(this).setMonthlyBudget(Number.parseFloat(amount));
});

Then("the saved config monthly budget is {int}", function (this: SettingsWorld, amount: number) {
  assert.equal(this.appConfig.monthlyBudget, amount);
});
