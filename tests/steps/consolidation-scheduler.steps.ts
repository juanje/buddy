// tests/steps/consolidation-scheduler.steps.ts — FR-CONSOL + FR-DEFERRED-02 BDD steps.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acquireLock, releaseLock } from "../../backends/maintenance";
import { startHeartbeat } from "../../backends/heartbeat";
import { runConsolidation } from "../../backends/consolidation-runner";
import { saveConsolidationState, loadConsolidationLog, defaultConsolidationState } from "../../shared/consolidation-state";
import { initTestGitRepo } from "../support/test-git";
import type { AbWorld } from "../support/world";
import type { DeferredItemView } from "../../shared/api";
import type { MaintenanceSessionLike } from "../../backends/consolidation-runner";

interface ConsolidationWorld extends AbWorld {
  consolTmpDir?: string;
  abDir?: string;
  deferredNotifications?: DeferredItemView[][];
  consolidationRuns?: number[];
  streaming?: boolean;
  heartbeat?: ReturnType<typeof startHeartbeat>;
}

After(function (this: ConsolidationWorld) {
  if (this.abDir) releaseLock(this.abDir);
  this.heartbeat?.stop();
  if (this.consolTmpDir) rmSync(this.consolTmpDir, { recursive: true, force: true });
});

Given("an AB directory prepared for consolidation", async function (this: ConsolidationWorld) {
  this.consolTmpDir = mkdtempSync(join(tmpdir(), "ab-consol-bdd-"));
  this.abDir = join(this.consolTmpDir, "buddy");
  mkdirSync(join(this.abDir, "agent_brain", "skills"), { recursive: true });
  writeFileSync(join(this.abDir, "AGENTS.md"), "# Rules\n");
  writeFileSync(
    join(this.abDir, "agent_brain", "skills", "consolidation.md"),
    "# Skill\n\nConsolidate.\n",
  );
  await initTestGitRepo(this.abDir);
  writeFileSync(join(this.abDir, "seed.txt"), "seed\n");
  const { simpleGit } = await import("simple-git");
  await simpleGit(this.abDir).add("-A").commit("seed");

  this.deferredNotifications = [];
  this.consolidationRuns = [];
  this.streaming = false;

  this.heartbeat = startHeartbeat({
    abDirectory: this.abDir,
    modelRuntime: {} as never,
    isStreaming: () => this.streaming === true,
    onDeferredDue: (items) => {
      this.deferredNotifications!.push(items);
    },
    intervalMs: 60_000,
    now: () => new Date("2026-07-22T10:00:00Z"),
    hasNewContentFn: async () => true,
    runConsolidationFn: async (options) => {
      const createSession = async (): Promise<MaintenanceSessionLike> => ({
        prompt: async () => {},
        dispose: () => {},
      });
      const result = await runConsolidation({
        ...options,
        createSession,
        now: new Date("2026-07-22T10:00:00Z"),
      });
      this.consolidationRuns!.push(...result.completedDepths);
      return result;
    },
  });
});

Given("the deferred queue has an item due today", function (this: ConsolidationWorld) {
  writeFileSync(
    join(this.abDir!, "agent_brain", "deferred.md"),
    "- **reminder** (2026-07-22, user): Llamar al dentista.\n",
  );
});

Given("3 sessions have completed since the last consolidation", function (this: ConsolidationWorld) {
  this.heartbeat!.incrementSessionCounter();
  this.heartbeat!.incrementSessionCounter();
  this.heartbeat!.incrementSessionCounter();
});

Given("there is new content since the last consolidation", function (this: ConsolidationWorld) {
  writeFileSync(join(this.abDir!, "new-content.txt"), "updated\n");
});

Given("the user is not streaming", function (this: ConsolidationWorld) {
  this.streaming = false;
});

Given("the user is streaming", function (this: ConsolidationWorld) {
  this.streaming = true;
});

Given("depth 2 consolidation is due", function (this: ConsolidationWorld) {
  const state = defaultConsolidationState();
  state.sessionsSinceLastDepth1 = 3;
  state.depth1RunsSinceLastDepth2 = 5;
  saveConsolidationState(this.abDir!, state);
});

Given("the maintenance lock is held", function (this: ConsolidationWorld) {
  acquireLock(this.abDir!);
});

When("the heartbeat ticks", async function (this: ConsolidationWorld) {
  await this.heartbeat!.tick();
});

When("consolidation is triggered at depth 1", async function (this: ConsolidationWorld) {
  const state = defaultConsolidationState();
  state.sessionsSinceLastDepth1 = 3;
  saveConsolidationState(this.abDir!, state);
  await this.heartbeat!.tick();
});

Then("deferred due notification is sent", function (this: ConsolidationWorld) {
  assert.ok(this.deferredNotifications!.some((batch) => batch.length > 0));
  assert.match(this.deferredNotifications![0]![0]!.text, /dentista/);
});

Then("daily consolidation runs at depth 1", function (this: ConsolidationWorld) {
  assert.deepEqual(this.consolidationRuns, [1]);
});

Then("consolidation does not run", function (this: ConsolidationWorld) {
  assert.equal(this.consolidationRuns!.length, 0);
});

Then("consolidation runs depths 1 and 2 in order", function (this: ConsolidationWorld) {
  assert.deepEqual(this.consolidationRuns, [1, 2]);
});

Then("a success entry is appended to the consolidation log", function (this: ConsolidationWorld) {
  const log = loadConsolidationLog(this.abDir!);
  assert.ok(log.some((entry) => entry.depth === 1 && entry.status === "success"));
});
