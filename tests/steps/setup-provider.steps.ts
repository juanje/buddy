// tests/steps/setup-provider.steps.ts — FR-SETUP-04 provider + API key.
// The controller drives the real configureProviderKey against a temp auth
// file and a fake probe (accepts keys starting with "valid"). No network,
// no LLM, never the user's real ~/.pi.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "svelte/store";

import { configureProviderKey, type ProviderId } from "../../backends/provider-auth";
import { AUTH_FILE_MODE } from "../../shared/defaults";
import { toPiProviderId } from "../../shared/provider-mapping";
import type { SetupController } from "../../src/lib/setup-controller";
import { assertRestricted } from "../support/assert-restricted";
import { advanceToProviderStep } from "../support/setup-wizard-helpers";
import { wizardOf } from "../support/setup-wizard-factory";
import type { BuddyWorld } from "../support/world";

interface ProviderWorld extends BuddyWorld {
  authTmpDir?: string;
  authPath?: string;
  wizard?: SetupController;
}

const fakeProbe = async (_provider: ProviderId, apiKey: string) =>
  apiKey.startsWith("valid") ? { ok: true } : { ok: false, error: "HTTP 401" };

const providerOverrides = (world: ProviderWorld) => ({
  async validateLocation() {
    return { status: "ok-new" as const };
  },
  async configureProviderKey(provider: ProviderId, apiKey: string, baseUrl?: string) {
    return configureProviderKey(provider, apiKey, {
      baseUrl,
      authPath: world.authPath!,
      probe: fakeProbe,
    });
  },
});

After(function (this: ProviderWorld) {
  if (this.authTmpDir) rmSync(this.authTmpDir, { recursive: true, force: true });
});

Given("the setup wizard is on the provider step", async function (this: ProviderWorld) {
  this.authTmpDir = mkdtempSync(join(tmpdir(), "buddy-provider-"));
  this.authPath = join(this.authTmpDir, "auth.json");

  await advanceToProviderStep(wizardOf(this, providerOverrides), join(this.authTmpDir, "buddy"));
});

// One definition serves Given/When/And phrasings alike.
Given("the user selects the {string} provider", function (this: ProviderWorld, id: string) {
  wizardOf(this, providerOverrides).selectProvider(id as ProviderId);
});

When("they submit an API key that the provider accepts", async function (this: ProviderWorld) {
  await wizardOf(this, providerOverrides).submitApiKey("valid-test-key");
});

When("they submit an API key that the provider rejects", async function (this: ProviderWorld) {
  await wizardOf(this, providerOverrides).submitApiKey("wrong-key");
});

When(
  "they provide a base URL and a key the provider accepts",
  async function (this: ProviderWorld) {
    await wizardOf(this, providerOverrides).submitApiKey("valid-test-key", "http://localhost:11434/v1");
  },
);

Then("an API key input is required before proceeding", function (this: ProviderWorld) {
  const wizard = wizardOf(this, providerOverrides);
  assert.equal(get(wizard.provider), "anthropic");
  assert.equal(get(wizard.keyCheck), undefined); // no verdict yet…
  assert.equal(get(wizard.canProceed), false); // …so the gate is closed
});

Then("a base URL input is required before proceeding", function (this: ProviderWorld) {
  const wizard = wizardOf(this, providerOverrides);
  assert.equal(get(wizard.needsBaseUrl), true);
  assert.equal(get(wizard.canProceed), false);
});

Then(
  "the key is stored in the auth file with restrictive permissions",
  function (this: ProviderWorld) {
    const store = JSON.parse(readFileSync(this.authPath!, "utf8"));
    const provider = get(wizardOf(this, providerOverrides).provider)!;
    assert.deepEqual(store[toPiProviderId(provider)], { type: "api_key", key: "valid-test-key" });
    // NFR-SEC-17 / review D4: shared ACL/mode helper.
    assertRestricted(this.authPath!, AUTH_FILE_MODE);
  },
);

Then("a key validation error is shown", function (this: ProviderWorld) {
  const check = get(wizardOf(this, providerOverrides).keyCheck);
  assert.ok(check && !check.valid && check.error.length > 0);
});

Then("nothing is stored in the auth file", function (this: ProviderWorld) {
  assert.equal(existsSync(this.authPath!), false);
});
