// tests/steps/session-log-prune.steps.ts — NFR-MAINT-01 BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBuddyInstance, defaultTemplatesDir } from "../../backends/create-buddy";
import { pruneSessionLogs } from "../../backends/session-log-prune";
import { APP_LOGS_DIR } from "../../shared/defaults";
import { MS_PER_DAY } from "../../shared/dates";
import type { SetupConfig } from "../../shared/api";
import type { BuddyWorld } from "../support/world";

interface SessionLogPruneWorld extends BuddyWorld {
  pruneTmpDir?: string;
  buddyDir?: string;
  logsDir?: string;
  pruneError?: Error;
}

After(function (this: SessionLogPruneWorld) {
  if (this.pruneTmpDir) rmSync(this.pruneTmpDir, { recursive: true, force: true });
});

Given("an initialized buddy git repository with session logs directory", async function (this: SessionLogPruneWorld) {
  this.pruneTmpDir = mkdtempSync(join(tmpdir(), "ab-prune-"));
  this.buddyDir = join(this.pruneTmpDir, "buddy");
  const config: SetupConfig = {
    rootDir: this.buddyDir,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    language: "en",
    name: "Test",
  };
  await createBuddyInstance({
    config,
    configPath: join(this.pruneTmpDir, "config.json"),
    templatesDir: defaultTemplatesDir(),
  });
  this.logsDir = join(this.buddyDir, APP_LOGS_DIR);
  mkdirSync(this.logsDir, { recursive: true });
});

function touchFileWithAge(dir: string, name: string, daysAgo: number): void {
  const filePath = join(dir, name);
  writeFileSync(filePath, "{}", "utf8");
  const mtime = new Date(Date.now() - daysAgo * MS_PER_DAY);
  utimesSync(filePath, mtime, mtime);
}

Given(
  /^a session log "(.*)" from (\d+) days? ago$/,
  function (this: SessionLogPruneWorld, name: string, daysAgo: number) {
    touchFileWithAge(this.logsDir!, name, daysAgo);
  },
);

Given("no session logs exist", function (this: SessionLogPruneWorld) {
  // logs directory exists but empty — Background already created it
});

Given(
  /^a file "(.*)" from (\d+) days? ago in session logs$/,
  function (this: SessionLogPruneWorld, name: string, daysAgo: number) {
    touchFileWithAge(this.logsDir!, name, daysAgo);
  },
);

When("session log pruning runs", function (this: SessionLogPruneWorld) {
  try {
    pruneSessionLogs(this.buddyDir!);
    this.pruneError = undefined;
  } catch (err) {
    this.pruneError = err instanceof Error ? err : new Error(String(err));
  }
});

Then(/^"(.*)" is deleted$/, function (this: SessionLogPruneWorld, name: string) {
  assert.ok(!existsSync(join(this.logsDir!, name)), `expected ${name} to be deleted`);
});

Then(/^"(.*)" is preserved$/, function (this: SessionLogPruneWorld, name: string) {
  assert.ok(existsSync(join(this.logsDir!, name)), `expected ${name} to be preserved`);
});

Then("no error occurs", function (this: SessionLogPruneWorld) {
  assert.equal(this.pruneError, undefined);
});
