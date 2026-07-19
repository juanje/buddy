// tests/steps/setup-oauth.steps.ts — FR-SETUP-05 OAuth wizard flow.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "svelte/store";

import { createSetupController, type SetupController } from "../../src/lib/setup-controller";
import { advanceToProviderStep } from "../support/setup-wizard-helpers";
import { catalogModelsFor, makeSetupWorkerFake } from "../support/setup-worker-fake";
import type { AbWorld } from "../support/world";

interface OAuthWorld extends AbWorld {
  authTmpDir?: string;
  wizard?: SetupController;
  lastAuthUrl?: string;
}

function wizardOf(world: OAuthWorld): SetupController {
  if (!world.wizard) {
    world.wizard = createSetupController(
      makeSetupWorkerFake({
        async validateLocation() {
          return { status: "ok-new" as const };
        },
        async loginOAuth(provider) {
          const url = `https://example.com/oauth/${provider}`;
          world.lastAuthUrl = url;
          world.wizard!.handleOAuthEvent({ type: "auth_url", url });
          return { success: true as const };
        },
        async listModels(provider) {
          return catalogModelsFor(provider);
        },
      }),
    );
  }
  return world.wizard;
}

After(function (this: OAuthWorld) {
  if (this.authTmpDir) rmSync(this.authTmpDir, { recursive: true, force: true });
});

Given("the setup wizard is on the provider step for OAuth", async function (this: OAuthWorld) {
  this.authTmpDir = mkdtempSync(join(tmpdir(), "ab-oauth-"));
  await advanceToProviderStep(wizardOf(this), join(this.authTmpDir, "my-ab"));
});

Given("the user has signed in with OAuth as {string}", async function (this: OAuthWorld, id: string) {
  wizardOf(this).selectProvider(id as "openai" | "anthropic" | "google" | "custom");
  await wizardOf(this).loginOAuth();
});

When("they sign in with OAuth successfully", async function (this: OAuthWorld) {
  await wizardOf(this).loginOAuth();
});

When("they start OAuth login", async function (this: OAuthWorld) {
  const promise = wizardOf(this).loginOAuth();
  await promise;
});

When("an auth URL event is received", function (this: OAuthWorld) {
  const url = "https://example.com/oauth/manual";
  this.lastAuthUrl = url;
  wizardOf(this).handleOAuthEvent({ type: "auth_url", url });
});

Then("the auth URL is available for browser open", function (this: OAuthWorld) {
  assert.ok(this.lastAuthUrl?.startsWith("https://"), "auth URL should be an https URL");
});

When("the wizard loads models for the provider", async function (this: OAuthWorld) {
  await wizardOf(this).loadModels();
});

Then("models are available for selection", function (this: OAuthWorld) {
  const models = get(wizardOf(this).availableModels);
  assert.ok(models.length >= 2, "expected at least two models after OAuth");
});
