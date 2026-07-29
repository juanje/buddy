// tests/steps/setup-oauth.steps.ts — FR-SETUP-05 OAuth wizard flow.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "svelte/store";

import type { OAuthLoginResult } from "../../shared/api";
import type { SetupController } from "../../src/lib/setup-controller";
import { advanceToProviderStep } from "../support/setup-wizard-helpers";
import { catalogModelsFor } from "../support/setup-worker-fake";
import { wizardOf } from "../support/setup-wizard-factory";
import type { BuddyWorld } from "../support/world";

interface OAuthWorld extends BuddyWorld {
  authTmpDir?: string;
  wizard?: SetupController;
  lastAuthUrl?: string;
  /** Set by a scenario to make the next login fail; default is success. */
  nextLoginResult?: OAuthLoginResult;
}

const oauthOverrides = (world: OAuthWorld) => ({
  async validateLocation() {
    return { status: "ok-new" as const };
  },
  async loginOAuth(provider: "anthropic" | "openai" | "google" | "custom") {
    if (world.nextLoginResult) return world.nextLoginResult;
    const url = `https://example.com/oauth/${provider}`;
    world.lastAuthUrl = url;
    world.wizard!.handleOAuthEvent({ type: "auth_url", url });
    return { success: true as const };
  },
  async listModels(provider: "anthropic" | "openai" | "google" | "custom") {
    return catalogModelsFor(provider);
  },
});

After(function (this: OAuthWorld) {
  if (this.authTmpDir) rmSync(this.authTmpDir, { recursive: true, force: true });
});

Given("the setup wizard is on the provider step for OAuth", async function (this: OAuthWorld) {
  this.authTmpDir = mkdtempSync(join(tmpdir(), "buddy-oauth-"));
  await advanceToProviderStep(wizardOf(this, oauthOverrides), join(this.authTmpDir, "buddy"));
});

Given("the user has signed in with OAuth as {string}", async function (this: OAuthWorld, id: string) {
  wizardOf(this, oauthOverrides).selectProvider(id as "openai" | "anthropic" | "google" | "custom");
  await wizardOf(this, oauthOverrides).loginOAuth();
});

When("they sign in with OAuth successfully", async function (this: OAuthWorld) {
  await wizardOf(this, oauthOverrides).loginOAuth();
});

When("they start OAuth login", async function (this: OAuthWorld) {
  const promise = wizardOf(this, oauthOverrides).loginOAuth();
  await promise;
});

When("an auth URL event is received", function (this: OAuthWorld) {
  const url = "https://example.com/oauth/manual";
  this.lastAuthUrl = url;
  wizardOf(this, oauthOverrides).handleOAuthEvent({ type: "auth_url", url });
});

Then("the auth URL is available for browser open", function (this: OAuthWorld) {
  assert.ok(this.lastAuthUrl?.startsWith("https://"), "auth URL should be an https URL");
});

// FR-SETUP-05: the worker reports cancellation as a flag. These two steps
// differ only in that flag, which is the point — before it existed, the
// frontend told them apart by string-comparing the error message.
When("they start OAuth login and cancel it", async function (this: OAuthWorld) {
  // Deliberately NOT the string the old code matched on. A scenario using
  // "Login cancelled" here would pass with the defect still in place, since
  // the literal comparison would happen to get the right answer. This message
  // is what a localized build or a reworded SDK abort would produce.
  this.nextLoginResult = {
    success: false,
    cancelled: true,
    error: "El inicio de sesión se canceló",
  };
  await wizardOf(this, oauthOverrides).loginOAuth();
});

When(
  "their OAuth login fails with {string}",
  async function (this: OAuthWorld, message: string) {
    this.nextLoginResult = { success: false, cancelled: false, error: message };
    await wizardOf(this, oauthOverrides).loginOAuth();
  },
);

Then("the wizard shows no authentication error", function (this: OAuthWorld) {
  assert.equal(get(wizardOf(this, oauthOverrides).oauthError), undefined);
});

Then(
  "the wizard shows the authentication error {string}",
  function (this: OAuthWorld, message: string) {
    assert.equal(get(wizardOf(this, oauthOverrides).oauthError), message);
  },
);

Then("the wizard does not allow proceeding to the next step", function (this: OAuthWorld) {
  assert.equal(get(wizardOf(this, oauthOverrides).canProceed), false);
});

When("the wizard loads models for the provider", async function (this: OAuthWorld) {
  await wizardOf(this, oauthOverrides).loadModels();
});

Then("models are available for selection", function (this: OAuthWorld) {
  const models = get(wizardOf(this, oauthOverrides).availableModels);
  assert.ok(models.length >= 2, "expected at least two models after OAuth");
});
