// tests/steps/setup-import.steps.ts — FR-SETUP-08 import existing instance.
// Real filesystem on temp dirs; adoption goes through the real backend
// functions (validateLocation, adoptAbInstance). No mocks of fs, no LLM.

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

import { adoptAbInstance } from "../../backends/create-ab";
import { validateLocation } from "../../backends/location";
import { detectFirstRun } from "../../backends/setup";
import { createSetupController, type SetupController } from "../../src/lib/setup-controller";
import { advanceToLocationStep } from "../support/setup-wizard-helpers";
import { makeSetupWorkerFake } from "../support/setup-worker-fake";
import type { AbWorld } from "../support/world";

interface ImportWorld extends AbWorld {
  importTmpDir?: string;
  abDir?: string;
  importConfigPath?: string;
  wizard?: SetupController;
  snapshot?: Map<string, string>;
  importOutcome?: "adopted" | "needs-provider";
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
  walk(world.abDir!);
  return files;
}

function makeWizard(world: ImportWorld): SetupController {
  world.wizard = createSetupController(
    makeSetupWorkerFake({
      async validateLocation(path: string) {
        return validateLocation(path);
      },
      async configureProviderKey() {
        return { valid: true as const };
      },
      async runSetup(config, mode) {
        assert.equal(mode, "import", "adopting an existing AB must use import mode");
        adoptAbInstance({ config, configPath: world.importConfigPath! });
      },
    }),
  );
  return world.wizard;
}

function seedAb(world: ImportWorld, options: { piSettings?: boolean; artifacts?: boolean }): void {
  world.importTmpDir = mkdtempSync(join(tmpdir(), "ab-import-"));
  world.abDir = join(world.importTmpDir, "old-ab");
  world.importConfigPath = join(world.importTmpDir, "config.json");

  mkdirSync(join(world.abDir, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(world.abDir, "agent_brain", "identity", "SOUL.md"), "# Custom soul\n");
  writeFileSync(join(world.abDir, "AGENTS.md"), "# My tuned rules\n");

  if (options.piSettings) {
    mkdirSync(join(world.abDir, ".pi"), { recursive: true });
    writeFileSync(
      join(world.abDir, ".pi", "settings.json"),
      JSON.stringify({ defaultProvider: "anthropic", defaultModel: "claude-haiku-4-5" }),
    );
  }
  if (options.artifacts) {
    mkdirSync(join(world.abDir, ".cursor"), { recursive: true });
    writeFileSync(join(world.abDir, ".cursor", "state.json"), "{}");
    mkdirSync(join(world.abDir, ".codex"), { recursive: true });
    writeFileSync(join(world.abDir, ".codex", "cache.bin"), "xx");
  }

  world.snapshot = snapshotAb(world);
}

After(function (this: ImportWorld) {
  if (this.importTmpDir) rmSync(this.importTmpDir, { recursive: true, force: true });
});

Given("an existing AB directory with Pi settings", function (this: ImportWorld) {
  seedAb(this, { piSettings: true });
});

Given("an existing AB directory containing platform artifacts", function (this: ImportWorld) {
  seedAb(this, { piSettings: true, artifacts: true });
});

Given("an existing AB directory without Pi settings", function (this: ImportWorld) {
  seedAb(this, { piSettings: false });
});

When("the user imports it from the location step", async function (this: ImportWorld) {
  const wizard = makeWizard(this);
  await advanceToLocationStep(wizard);
  await wizard.pickLocation(this.abDir!);
  assert.equal(get(wizard.locationCheck)?.status, "existing-ab");
  this.importOutcome = await wizard.importExisting();
});

Then("the app is configured to use that directory", function (this: ImportWorld) {
  const state = detectFirstRun(this.importConfigPath!);
  assert.equal(state.firstRun, false);
  if (!state.firstRun) assert.equal(state.config.rootDir, this.abDir);
  assert.equal(get(this.wizard!.completed), true);
});

Then("no file inside the AB directory is modified", function (this: ImportWorld) {
  assert.deepEqual(snapshotAb(this), this.snapshot);
});

Then("the platform artifacts remain untouched", function (this: ImportWorld) {
  assert.equal(readFileSync(join(this.abDir!, ".cursor", "state.json"), "utf8"), "{}");
  assert.equal(readFileSync(join(this.abDir!, ".codex", "cache.bin"), "utf8"), "xx");
});

Then("the wizard continues to the provider step in import mode", function (this: ImportWorld) {
  assert.equal(this.importOutcome, "needs-provider");
  assert.equal(get(this.wizard!.step), "provider");
  assert.equal(get(this.wizard!.importMode), true);
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
    // Adoption, not creation: the fresh-AB templates were not copied in…
    assert.equal(existsSync(join(this.abDir!, "user")), false);
    assert.equal(existsSync(join(this.abDir!, "logs")), false);
    // …but the collected provider/model were written (settings were missing).
    const settings = JSON.parse(readFileSync(join(this.abDir!, ".pi", "settings.json"), "utf8"));
    assert.deepEqual(settings, {
      defaultProvider: "anthropic",
      defaultModel: "claude-sonnet-5",
    });
  },
);

When("the wizard adopts it with provider {string}", function (this: ImportWorld, provider: string) {
  adoptAbInstance({
    config: {
      rootDir: this.abDir!,
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
    const settings = JSON.parse(readFileSync(join(this.abDir!, relPath), "utf8"));
    assert.equal(settings.defaultProvider, expectedProvider);
  },
);
