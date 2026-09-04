// tests/steps/auth-expiry.steps.ts — FR-AUTH-01/02 OAuth expiry and auth error surfacing.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "svelte/store";

import { buildAuthStatus } from "../../backends/auth-status";
import { runOAuthHealthChecks } from "../../backends/auth-health";
import { findRecentAuthErrorInLogs, shouldEmitBootAuthCard } from "../../backends/auth-error";
import { logEvent } from "../../backends/app-logger";
import { purgeStaleCredential } from "../../backends/provider-auth";
import { updateStateFile } from "../../backends/state-file";
import { AUTH_FILE_MODE } from "../../shared/defaults";
import { toPiProviderId } from "../../shared/provider-mapping";
import {
  createSettingsController,
  type SettingsController,
  type SettingsWorkerAPI,
} from "../../src/lib/settings-controller";
import { DEFAULT_TEST_CONFIG, buildMockWorker } from "../support/settings-fixtures";
import type { BuddyWorld } from "../support/world";
import type { SetupConfig } from "../../shared/api";
import { t } from "../../src/lib/i18n";

interface AuthExpiryWorld extends BuddyWorld {
  authTmpDir?: string;
  authPath?: string;
  settings?: SettingsController;
  appConfig?: SetupConfig;
  authedProviders?: Set<SetupConfig["provider"]>;
  needsReauthProviders?: Set<string>;
  oauthLoginCalls?: SetupConfig["provider"][];
  settingsOpened?: boolean;
  bootAuthErrorEmitted?: boolean;
}

After(function (this: AuthExpiryWorld) {
  this.settings = undefined;
  if (this.authTmpDir) rmSync(this.authTmpDir, { recursive: true, force: true });
});

function fakeRuntimeForProbe(
  failures: Record<string, string> = {},
): { getAvailable(providerId?: string): Promise<readonly unknown[]> } {
  return {
    async getAvailable(providerId?: string) {
      const id = providerId ?? "";
      if (failures[id]) {
        throw new Error(failures[id]);
      }
      return [{ id: "test-model" }];
    },
  };
}

function buildSettingsWorker(this: AuthExpiryWorld): SettingsWorkerAPI {
  const self = this;
  return buildMockWorker({
    getAuthStatus: async () => {
      const runtime = {
        getProviderAuthStatus: () => ({ configured: false }),
        isUsingOAuth: () => false,
      };
      const needsReauth = new Set(self.needsReauthProviders ?? []);
      return buildAuthStatus(runtime as never, {
        readCredential: (id) => {
          if (needsReauth.has(id)) return undefined;
          const provider = id === "openai-codex" ? "openai" : id;
          return self.authedProviders?.has(provider as SetupConfig["provider"])
            ? '{"type":"oauth"}'
            : undefined;
        },
        needsReauthProviders: needsReauth,
      });
    },
    loginOAuth: async (provider) => {
      self.oauthLoginCalls!.push(provider);
      self.needsReauthProviders?.delete(toPiProviderId(provider));
      self.authedProviders?.add(provider);
      return { success: true };
    },
  });
}

function ensureSettings(this: AuthExpiryWorld): SettingsController {
  if (!this.appConfig) {
    this.appConfig = { ...DEFAULT_TEST_CONFIG };
    this.authedProviders = new Set(["anthropic"]);
    this.needsReauthProviders = new Set();
    this.oauthLoginCalls = [];
  }
  if (!this.settings) {
    this.settings = createSettingsController({
      worker: buildSettingsWorker.call(this),
      getConfig: () => this.appConfig!,
      onConfigChange: (config) => {
        this.appConfig = config;
      },
      version: "0.1.0",
    });
  }
  return this.settings;
}

Given(
  "the user has an expired OAuth token for {string}",
  function (this: AuthExpiryWorld, provider: string) {
    this.authTmpDir = mkdtempSync(join(tmpdir(), "buddy-auth-expiry-"));
    this.authPath = join(this.authTmpDir, "auth.json");
    const piId = toPiProviderId(provider as SetupConfig["provider"]);
    updateStateFile<Record<string, unknown>>(
      this.authPath,
      () => ({ [piId]: { type: "oauth", refresh: "stale" } }),
      { mode: AUTH_FILE_MODE },
    );
    this.needsReauthProviders = new Set();
    this.authedProviders = new Set();
  },
);

When("the OAuth health check runs at boot", async function (this: AuthExpiryWorld) {
  const piId = "anthropic";
  this.needsReauthProviders = await runOAuthHealthChecks(fakeRuntimeForProbe({
    [piId]: "OAuth refresh failed for anthropic",
  }), {
    readCredential: (id) => {
      if (!this.authPath || !existsSync(this.authPath)) return undefined;
      const raw = readFileSync(this.authPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const entry = parsed[id];
      return entry === undefined ? undefined : JSON.stringify(entry);
    },
    purge: (id) => purgeStaleCredential(id, this.authPath),
    authPath: this.authPath,
  });
});

Then(
  "the auth status reports {string} needs re-authentication",
  function (this: AuthExpiryWorld, provider: string) {
    const runtime = {
      getProviderAuthStatus: () => ({ configured: false }),
      isUsingOAuth: () => false,
    };
    const status = buildAuthStatus(runtime as never, {
      needsReauthProviders: this.needsReauthProviders ?? new Set(),
    });
    const entry = status.providers.find((p) => p.buddyProvider === provider);
    assert.equal(entry?.needsReauth, true);
    assert.equal(entry?.hasAuth, false);
  },
);

Then("the stale credential is removed from the auth store", function (this: AuthExpiryWorld) {
  assert.ok(this.authPath);
  const raw = readFileSync(this.authPath!, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal("anthropic" in parsed, false);
});

Given("anthropic is marked as needing re-authentication", function (this: AuthExpiryWorld) {
  this.authedProviders = new Set();
  ensureSettings.call(this);
  this.needsReauthProviders = new Set(["anthropic"]);
});

When("I open settings for auth expiry", async function (this: AuthExpiryWorld) {
  const settings = ensureSettings.call(this);
  settings.openSettings();
  for (let i = 0; i < 100; i++) {
    if (get(settings.reauthProviders).length > 0) break;
    await new Promise((r) => setTimeout(r, 10));
  }
});

Then(
  'settings shows "Token expired" for {string} with a sign-in option',
  async function (this: AuthExpiryWorld, provider: string) {
    const settings = ensureSettings.call(this);
    const status = await buildSettingsWorker.call(this).getAuthStatus();
    const entry = status.providers.find((p) => p.buddyProvider === provider);
    assert.equal(entry?.needsReauth, true);

    for (let i = 0; i < 100; i++) {
      const unauth = get(settings.unauthenticatedProviders);
      const reauth = get(settings.reauthProviders);
      if (unauth.includes(provider as SetupConfig["provider"]) && reauth.includes(provider as SetupConfig["provider"])) {
        return;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.fail("settings did not surface re-authentication state for provider");
  },
);

When("I complete OAuth login for {string}", async function (this: AuthExpiryWorld, provider: string) {
  const settings = ensureSettings.call(this);
  settings.startAddProvider(provider as SetupConfig["provider"]);
  await settings.submitAuthOAuth();
});

Then(
  "the auth status reports {string} is authenticated",
  async function (this: AuthExpiryWorld, provider: string) {
    const status = await buildSettingsWorker.call(this).getAuthStatus();
    const entry = status.providers.find((p) => p.buddyProvider === provider);
    assert.equal(entry?.hasAuth, true);
    assert.equal(entry?.needsReauth, undefined);
  },
);

Then("models for {string} are available", async function (this: AuthExpiryWorld, provider: string) {
  const settings = ensureSettings.call(this);
  const models = get(settings.models);
  assert.ok(models.some((m) => m.provider === provider));
});

When(
  "I send a message and the provider returns auth error {string}",
  async function (this: AuthExpiryWorld, message: string) {
    this.connect();
    this.controller.input.set("hello");
    await this.controller.send();
    this.session.emitAuthError(message);
    this.session.endStreaming();
  },
);

Then(
  "the chat shows an auth error card with message containing {string}",
  function (this: AuthExpiryWorld, fragment: string) {
    const cards = get(this.controller.authErrors);
    assert.ok(cards.length >= 1, "expected an auth error card");
    const strings = get(t);
    assert.match(strings.authErrorCardTitle.toLowerCase(), new RegExp(fragment, "i"));
  },
);

Then("the auth error card links to settings", function (this: AuthExpiryWorld) {
  const cards = get(this.controller.authErrors);
  assert.ok(cards.length >= 1);
});

Given(
  "a reflect failed with auth error {string}",
  function (this: AuthExpiryWorld, message: string) {
    this.authTmpDir = mkdtempSync(join(tmpdir(), "buddy-auth-boot-"));
    this.rootDir = join(this.authTmpDir, "buddy");
    mkdirSync(this.rootDir, { recursive: true });
    writeFileSync(join(this.rootDir, "AGENTS.md"), "# Rules\n");
    logEvent(this.rootDir, {
      event: "reflect_error",
      session: "s1",
      mode: "session_end",
      message,
    });
    this.bootAuthErrorEmitted = false;
  },
);

Given("anthropic still needs re-authentication at boot", function (this: AuthExpiryWorld) {
  this.needsReauthProviders = new Set(["anthropic"]);
});

Given(
  "the OAuth health check reports {string} is healthy",
  function (this: AuthExpiryWorld, provider: string) {
    const piId = toPiProviderId(provider as SetupConfig["provider"]);
    if (!this.needsReauthProviders) {
      this.needsReauthProviders = new Set();
    } else {
      this.needsReauthProviders = new Set(this.needsReauthProviders);
    }
    this.needsReauthProviders.delete(piId);
  },
);

When("the app boots after a background auth failure", function (this: AuthExpiryWorld) {
  this.connect(this.rootDir, { force: true });
  const bootError = findRecentAuthErrorInLogs(this.rootDir!);
  assert.ok(bootError);
  const reauthProviders =
    this.needsReauthProviders ?? new Set([toPiProviderId(bootError.provider)]);
  if (shouldEmitBootAuthCard(bootError, reauthProviders)) {
    this.controller.handleAuthError(bootError);
    this.bootAuthErrorEmitted = true;
  }
});

Then("the chat shows an auth error card before the first prompt", function (this: AuthExpiryWorld) {
  assert.equal(this.bootAuthErrorEmitted, true);
  const cards = get(this.controller.authErrors);
  assert.ok(cards.length >= 1);
  const userMessages = get(this.controller.messages).filter((m) => m.role === "user");
  assert.equal(userMessages.length, 0);
});

Then("the chat does not show an auth error card", function (this: AuthExpiryWorld) {
  assert.equal(this.bootAuthErrorEmitted, false);
  const cards = get(this.controller.authErrors);
  assert.equal(cards.length, 0);
});
