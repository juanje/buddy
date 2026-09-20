// tests/steps/provider-mapping.steps.ts — FR-SETTINGS-03c provider mapping.

import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { configureProviderKey } from "../../backends/provider-auth";
import { buildAuthStatus } from "../../backends/auth-status";
import type { BuddyWorld } from "../support/world";

interface MappingWorld extends BuddyWorld {
  authTmpDir?: string;
  authPath?: string;
  runtimeConfig?: Record<string, { configured: boolean; oauth?: boolean }>;
}

Given("{string} provider key was configured via API key", async function (this: MappingWorld, provider: string) {
  this.authTmpDir = mkdtempSync(join(tmpdir(), "mapping-"));
  this.authPath = join(this.authTmpDir, "auth.json");
  await configureProviderKey(provider as any, "valid-test-key", {
    authPath: this.authPath,
    probe: async () => ({ ok: true }),
  });
});

Then(
  "the auth store entry is keyed by Pi provider {string}",
  function (this: MappingWorld, expectedPiProvider: string) {
    const store = JSON.parse(readFileSync(this.authPath!, "utf8"));
    assert.ok(
      expectedPiProvider in store,
      `Expected key "${expectedPiProvider}" in auth store, got: ${Object.keys(store).join(", ")}`,
    );
    if (this.authTmpDir) rmSync(this.authTmpDir, { recursive: true, force: true });
  },
);

Given(
  "the runtime has configured auth for Pi provider {string}",
  function (this: MappingWorld, piProvider: string) {
    this.runtimeConfig = { ...this.runtimeConfig, [piProvider]: { configured: true } };
  },
);

Then(
  "auth status reports OpenAI with Pi provider {string}",
  function (this: MappingWorld, expectedPiProvider: string) {
    const runtime = {
      getProviderAuthStatus: (id: string) => ({
        configured: this.runtimeConfig?.[id]?.configured ?? false,
      }),
      isUsingOAuth: (id: string) => this.runtimeConfig?.[id]?.oauth ?? false,
    } as unknown as ModelRuntime;

    const status = buildAuthStatus(runtime, { readCredential: () => undefined });
    const openai = status.providers.find((p) => p.buddyProvider === "openai");
    assert.ok(openai, "Expected an OpenAI entry in auth status");
    assert.equal(openai.piProviderId, expectedPiProvider);
    assert.equal(openai.hasAuth, true);
  },
);
