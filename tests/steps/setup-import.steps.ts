// tests/steps/setup-import.steps.ts — FR-SETUP-08 import existing instance.
// Real filesystem on temp dirs; adoption goes through the real backend
// functions (validateLocation, adoptBuddyInstance). No mocks of fs, no LLM.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "svelte/store";

import { adoptBuddyInstance } from "../../backends/create-buddy";
import { validateLocation } from "../../backends/location";
import { detectFirstRun } from "../../backends/setup";
import { createSetupController, type SetupController } from "../../src/lib/setup-controller";
import { advanceToLocationStep } from "../support/setup-wizard-helpers";
import { makeSetupWorkerFake } from "../support/setup-worker-fake";
import type { BuddyWorld } from "../support/world";

interface ImportWorld extends BuddyWorld {
  importTmpDir?: string;
  buddyDir?: string;
  importConfigPath?: string;
  wizard?: SetupController;
  snapshot?: Map<string, string>;
  importOutcome?: "adopted" | "needs-provider";
  authHasAnthropic?: boolean;
}

function snapshotAb(world: ImportWorld): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.set(full, readFileSync(full, "utf8"));
    }
  };
  walk(world.buddyDir!);
  return files;
}

function authedAnthropicStatus() {
  return {
    providers: [
      {
        piProviderId: "anthropic",
        buddyProvider: "anthropic" as const,
        hasAuth: true,
        authType: "oauth" as const,
      },
      {
        piProviderId: "openai-codex",
        buddyProvider: "openai" as const,
        hasAuth: false,
      },
      {
        piProviderId: "google",
        buddyProvider: "google" as const,
        hasAuth: false,
      },
    ],
  };
}

function makeWizard(world: ImportWorld, authHasAnthropic = true): SetupController {
  world.wizard = createSetupController(
    makeSetupWorkerFake({
      async validateLocation(path: string) {
        return validateLocation(path);
      },
      async configureProviderKey() {
        return { valid: true as const };
      },
      async getAuthStatus() {
        if (authHasAnthropic) return authedAnthropicStatus();
        return {
          providers: authedAnthropicStatus().providers.map((p) => ({ ...p, hasAuth: false })),
        };
      },
      async runSetup(config, mode) {
        assert.equal(mode, "import", "adopting an existing buddy instance must use import mode");
        adoptBuddyInstance({ config, configPath: world.importConfigPath! });
      },
    }),
  );
  return world.wizard;
}

function seedAb(world: ImportWorld, options: { piSettings?: boolean; artifacts?: boolean }): void {
  world.importTmpDir = mkdtempSync(join(tmpdir(), "ab-import-"));
  world.buddyDir = join(world.importTmpDir, "old-ab");
  world.importConfigPath = join(world.importTmpDir, "config.json");

  mkdirSync(join(world.buddyDir, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(world.buddyDir, "agent_brain", "identity", "SOUL.md"), "# Custom soul\n");
  writeFileSync(join(world.buddyDir, "AGENTS.md"), "# My tuned rules\n");

  if (options.piSettings) {
    mkdirSync(join(world.buddyDir, ".pi"), { recursive: true });
    writeFileSync(
      join(world.buddyDir, ".pi", "settings.json"),
      JSON.stringify({ defaultProvider: "anthropic", defaultModel: "claude-haiku-4-5" }),
    );
  }
  if (options.artifacts) {
    mkdirSync(join(world.buddyDir, ".cursor"), { recursive: true });
    writeFileSync(join(world.buddyDir, ".cursor", "state.json"), "{}");
    mkdirSync(join(world.buddyDir, ".codex"), { recursive: true });
    writeFileSync(join(world.buddyDir, ".codex", "cache.bin"), "xx");
  }

  world.snapshot = snapshotAb(world);
}

After(function (this: ImportWorld) {
  if (this.importTmpDir) rmSync(this.importTmpDir, { recursive: true, force: true });
});

Given("an existing buddy directory with Pi settings", function (this: ImportWorld) {
  seedAb(this, { piSettings: true });
});

Given("an existing buddy directory containing platform artifacts", function (this: ImportWorld) {
  seedAb(this, { piSettings: true, artifacts: true });
});

Given("an existing buddy directory without Pi settings", function (this: ImportWorld) {
  seedAb(this, { piSettings: false });
});

Given("the configured provider has valid auth credentials", function (this: ImportWorld) {
  this.authHasAnthropic = true;
});

Given("the configured provider has no auth credentials", function (this: ImportWorld) {
  this.authHasAnthropic = false;
});

When("the user imports it from the location step", async function (this: ImportWorld) {
  const wizard = makeWizard(this, this.authHasAnthropic !== false);
  await advanceToLocationStep(wizard);
  await wizard.pickLocation(this.buddyDir!);
  assert.equal(get(wizard.locationCheck)?.status, "existing-buddy");
  this.importOutcome = await wizard.importExisting();
});

Then("the app is configured to use that directory", function (this: ImportWorld) {
  const state = detectFirstRun(this.importConfigPath!);
  assert.equal(state.firstRun, false);
  if (!state.firstRun) assert.equal(state.config.rootDir, this.buddyDir);
  assert.equal(get(this.wizard!.completed), true);
});

Then("no pre-existing file is modified", function (this: ImportWorld) {
  // Buddy may *add* its runtime-state ignore rules (FR-SETUP-10, amended); it
  // must not touch anything that was already there.
  const now = snapshotAb(this);
  for (const [path, content] of this.snapshot!) {
    assert.equal(now.get(path), content, `${path} must not be modified`);
  }
});

Then("buddy's runtime state is gitignored", function (this: ImportWorld) {
  const content = readFileSync(join(this.buddyDir!, ".gitignore"), "utf8");
  assert.match(content, /^\.buddy\/$/m);
  assert.match(content, /^\.pi\/$/m);
});

Then("the platform artifacts remain untouched", function (this: ImportWorld) {
  assert.equal(readFileSync(join(this.buddyDir!, ".cursor", "state.json"), "utf8"), "{}");
  assert.equal(readFileSync(join(this.buddyDir!, ".codex", "cache.bin"), "utf8"), "xx");
});

Then("the wizard continues to the provider step in import mode", function (this: ImportWorld) {
  assert.equal(this.importOutcome, "needs-provider");
  assert.equal(get(this.wizard!.step), "provider");
  assert.equal(get(this.wizard!.importMode), true);
});

Then("the provider step is pre-selected with the instance provider", function (this: ImportWorld) {
  assert.equal(get(this.wizard!.provider), "anthropic");
  assert.equal(get(this.wizard!.model), "claude-haiku-4-5");
});

Then(
  "completing the wizard adopts the directory without copying templates",
  async function (this: ImportWorld) {
    const wizard = this.wizard!;
    wizard.selectProvider("anthropic");
    await wizard.submitApiKey("valid-key");
    wizard.next(); // → model
    await wizard.finishSetup();

    assert.equal(get(wizard.completed), true);
    // Adoption, not creation: the fresh-buddy templates were not copied in…
    assert.equal(existsSync(join(this.buddyDir!, "user")), false);
    assert.equal(existsSync(join(this.buddyDir!, "logs")), false);
    // …but the collected provider/model were written (settings were missing).
    const settings = JSON.parse(readFileSync(join(this.buddyDir!, ".pi", "settings.json"), "utf8"));
    assert.deepEqual(settings, {
      defaultProvider: "anthropic",
      defaultModel: "claude-sonnet-5",
    });
  },
);

When("the wizard adopts it with provider {string}", function (this: ImportWorld, provider: string) {
  adoptBuddyInstance({
    config: {
      rootDir: this.buddyDir!,
      provider: provider as "openai" | "anthropic" | "google" | "custom",
      model: "gpt-5",
    },
    configPath: this.importConfigPath ?? join(this.importTmpDir!, "config.json"),
  });
  if (!this.importConfigPath && this.importTmpDir) {
    this.importConfigPath = join(this.importTmpDir, "config.json");
  }
});

Then(
  "{string} contains defaultProvider {string}",
  function (this: ImportWorld, relPath: string, expectedProvider: string) {
    const settings = JSON.parse(readFileSync(join(this.buddyDir!, relPath), "utf8"));
    assert.equal(settings.defaultProvider, expectedProvider);
  },
);
