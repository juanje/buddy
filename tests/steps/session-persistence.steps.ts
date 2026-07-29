// tests/steps/session-persistence.steps.ts — FR-REFLECT-05 BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBuddyInstance, defaultTemplatesDir } from "../../backends/create-buddy";
import {
  persistLiveSession,
  recoverStaleSession,
} from "../../backends/crash-recovery";
import { SessionLifecycle } from "../../backends/session-lifecycle";
import type { SpawnReflectOptions } from "../../backends/reflect-spawn";
import type { SetupConfig } from "../../shared/api";
import {
  loadConsolidationState,
  saveConsolidationState,
} from "../../shared/consolidation-state";
import type { BuddyWorld } from "../support/world";

interface SessionPersistenceWorld extends BuddyWorld {
  persistTmpDir?: string;
  buddyDir?: string;
  lifecycle?: SessionLifecycle;
  recoverySpawns?: SpawnReflectOptions[];
}

After(function (this: SessionPersistenceWorld) {
  if (this.persistTmpDir) rmSync(this.persistTmpDir, { recursive: true, force: true });
});

Given("an initialized buddy git repository for session persistence", async function (this: SessionPersistenceWorld) {
  this.persistTmpDir = mkdtempSync(join(tmpdir(), "buddy-persist-"));
  this.buddyDir = join(this.persistTmpDir, "buddy");
  const config: SetupConfig = {
    rootDir: this.buddyDir,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    language: "en",
    name: "Test",
  };
  await createBuddyInstance({
    config,
    configPath: join(this.persistTmpDir, "config.json"),
    templatesDir: defaultTemplatesDir(),
  });
  this.recoverySpawns = [];
});

When("a new session starts with file {string}", function (this: SessionPersistenceWorld, sessionFile: string) {
  persistLiveSession(this.buddyDir!, sessionFile);
});

Given(
  "a session is running with persisted path {string}",
  function (this: SessionPersistenceWorld, sessionFile: string) {
    persistLiveSession(this.buddyDir!, sessionFile);
    this.lifecycle = new SessionLifecycle({
      rootDir: this.buddyDir!,
      sessionId: "test-session",
      sessionFile,
      // NFR-TEST-02: without this the production default applied and shutdown
      // forked a real detached reflect child on every run of this suite.
      spawnReflect: (options) => {
        this.recoverySpawns!.push(options);
        return 1;
      },
    });
  },
);

When("the app shuts down gracefully", async function (this: SessionPersistenceWorld) {
  await this.lifecycle!.shutdown();
});

Given(
  "consolidation-state.json has liveSessionFile {string} and reflectPending {word}",
  function (this: SessionPersistenceWorld, sessionFile: string, pending: string) {
    const state = loadConsolidationState(this.buddyDir!);
    state.liveSessionFile = sessionFile;
    state.reflectPending = pending === "true";
    saveConsolidationState(this.buddyDir!, state);
  },
);

When("the app boots", function (this: SessionPersistenceWorld) {
  this.recoverySpawns = [];
  recoverStaleSession(this.buddyDir!, (options) => {
    this.recoverySpawns!.push(options);
    return 1;
  });
});

Then(
  "consolidation-state.json contains liveSessionFile {string}",
  function (this: SessionPersistenceWorld, expected: string) {
    const state = loadConsolidationState(this.buddyDir!);
    assert.equal(state.liveSessionFile, expected);
  },
);

Then(
  "consolidation-state.json has reflectPending {word}",
  function (this: SessionPersistenceWorld, expected: string) {
    const state = loadConsolidationState(this.buddyDir!);
    assert.equal(state.reflectPending, expected === "true");
  },
);

Then(
  "consolidation-state.json has liveSessionFile cleared",
  function (this: SessionPersistenceWorld) {
    const state = loadConsolidationState(this.buddyDir!);
    assert.ok(state.liveSessionFile === null || state.liveSessionFile === undefined);
  },
);

Then(
  "a session-end reflect spawn was requested for {string}",
  function (this: SessionPersistenceWorld, sessionFile: string) {
    const calls = (this.recoverySpawns ?? []).filter((call) => call.mode === "session-end");
    assert.ok(calls.length > 0, "expected a session-end reflect spawn");
    assert.equal(calls[0].forkedSessionFile, sessionFile);
  },
);

Then("no reflect spawn was requested", function (this: SessionPersistenceWorld) {
  assert.equal(this.recoverySpawns?.length ?? 0, 0);
});
