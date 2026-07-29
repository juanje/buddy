// tests/steps/consolidation-scheduler.steps.ts — FR-CONSOL + FR-DEFERRED-02 BDD steps.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acquireLock, releaseLock } from "../../backends/maintenance";
import { startHeartbeat } from "../../backends/heartbeat";
import {
  createMaintenancePermissionPolicy,
  runConsolidation,
} from "../../backends/consolidation-runner";
import { createPermissionGate } from "../../backends/permissions";
import {
  defaultConsolidationState,
  depthFailureCount,
  loadConsolidationLog,
  loadConsolidationState,
  saveConsolidationState,
} from "../../shared/consolidation-state";
import { CONSOLIDATION_RETRY_CEILING } from "../../shared/defaults";
import { initTestGitRepo } from "../support/test-git";
import type { BuddyWorld } from "../support/world";
import type { DeferredItemView } from "../../shared/api";
import type { MaintenanceSessionLike } from "../../backends/consolidation-runner";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import { TEST_FROZEN_NOW, TEST_HEARTBEAT_INTERVAL_MS } from "../support/test-constants";

interface ConsolidationWorld extends BuddyWorld {
  consolTmpDir?: string;
  globalConfigDir?: string;
  buddyDir?: string;
  deferredNotifications?: DeferredItemView[][];
  consolidationRuns?: number[];
  streaming?: boolean;
  heartbeat?: ReturnType<typeof startHeartbeat>;
  /** Depth at which the scripted maintenance session throws (FR-CONSOL-09). */
  failAtDepth?: number;
  /** Depth after which the budget threshold is reported crossed (FR-COST-05). */
  budgetCrossesAfterDepth?: number;
  depthsPrompted?: number[];
  maintenancePausedNotices?: number[];
  maintenancePolicy?: ReturnType<typeof createMaintenancePermissionPolicy>;
  maintenanceGateResult?: { block: true; reason: string } | undefined;
}

After(function (this: ConsolidationWorld) {
  if (this.buddyDir) releaseLock(this.buddyDir);
  this.heartbeat?.stop();
  teardownGlobalConfigDir(this.globalConfigDir);
  if (this.consolTmpDir) rmSync(this.consolTmpDir, { recursive: true, force: true });
});

Given("a buddy directory prepared for consolidation", async function (this: ConsolidationWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir({
    consolidationSkill: "# Skill\n\nConsolidate.\n",
  }));
  this.consolTmpDir = mkdtempSync(join(tmpdir(), "buddy-consol-bdd-"));
  this.buddyDir = join(this.consolTmpDir, "buddy");
  mkdirSync(join(this.buddyDir, "agent_brain"), { recursive: true });
  writeFileSync(join(this.buddyDir, "AGENTS.md"), "# Rules\n");
  await initTestGitRepo(this.buddyDir);
  writeFileSync(join(this.buddyDir, "seed.txt"), "seed\n");
  const { simpleGit } = await import("simple-git");
  await simpleGit(this.buddyDir).add("-A").commit("seed");

  this.deferredNotifications = [];
  this.consolidationRuns = [];
  this.depthsPrompted = [];
  this.maintenancePausedNotices = [];
  this.streaming = false;

  this.heartbeat = startHeartbeat({
    rootDir: this.buddyDir,
    modelRuntime: {} as never,
    isStreaming: () => this.streaming === true,
    onDeferredDue: (items) => {
      this.deferredNotifications!.push(items);
    },
    onMaintenancePaused: (depth) => {
      this.maintenancePausedNotices!.push(depth);
    },
    // The runner re-checks this before each depth (FR-COST-05); the scenario
    // decides after which depth it starts returning true.
    isBudgetNearLimit: () =>
      this.budgetCrossesAfterDepth !== undefined &&
      this.depthsPrompted!.length > this.budgetCrossesAfterDepth - 1,
    intervalMs: TEST_HEARTBEAT_INTERVAL_MS,
    now: () => TEST_FROZEN_NOW,
    hasNewContentFn: async () => true,
    runConsolidationFn: async (options) => {
      let currentDepth = 0;
      const createSession = async (): Promise<MaintenanceSessionLike> => ({
        prompt: async (text: string) => {
          currentDepth = Number(/Run consolidation at depth (\d)/.exec(text)?.[1] ?? 0);
          this.depthsPrompted!.push(currentDepth);
          if (this.failAtDepth === currentDepth) {
            throw new Error(`scripted failure at depth ${currentDepth}`);
          }
        },
        dispose: () => {},
      });
      const result = await runConsolidation({
        ...options,
        createSession,
        now: TEST_FROZEN_NOW,
      });
      this.consolidationRuns!.push(...result.completedDepths);
      return result;
    },
  });
});

Given("the deferred queue has an item due today", function (this: ConsolidationWorld) {
  writeFileSync(
    join(this.buddyDir!, "agent_brain", "deferred.md"),
    "- **reminder** (2026-07-22, user): Llamar al dentista.\n",
  );
});

Given("3 sessions have completed since the last consolidation", function (this: ConsolidationWorld) {
  this.heartbeat!.incrementSessionCounter();
  this.heartbeat!.incrementSessionCounter();
  this.heartbeat!.incrementSessionCounter();
});

Given("1 session has completed since the last consolidation", function (this: ConsolidationWorld) {
  this.heartbeat!.incrementSessionCounter();
});

Given("consolidation has never run before", function (this: ConsolidationWorld) {
  const state = defaultConsolidationState();
  state.lastDepth1 = null;
  state.sessionsSinceLastDepth1 = 1;
  saveConsolidationState(this.buddyDir!, state);
});

Given("there is new content since the last consolidation", function (this: ConsolidationWorld) {
  writeFileSync(join(this.buddyDir!, "new-content.txt"), "updated\n");
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
  saveConsolidationState(this.buddyDir!, state);
});

Given("the maintenance lock is held", function (this: ConsolidationWorld) {
  acquireLock(this.buddyDir!);
});

When("the heartbeat ticks", async function (this: ConsolidationWorld) {
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
  const log = loadConsolidationLog(this.buddyDir!);
  assert.ok(log.some((entry) => entry.depth === 1 && entry.status === "success"));
});

// --- FR-CONSOL-08/09, FR-COST-05 ---

Given("depth 3 consolidation is due", function (this: ConsolidationWorld) {
  const state = defaultConsolidationState();
  state.sessionsSinceLastDepth1 = 3;
  state.depth1RunsSinceLastDepth2 = 5;
  state.depth2RunsSinceLastDepth3 = 4;
  saveConsolidationState(this.buddyDir!, state);
});

Given(
  "the maintenance session fails at depth {int}",
  function (this: ConsolidationWorld, depth: number) {
    this.failAtDepth = depth;
  },
);

Given(
  "the budget threshold is crossed after depth {int}",
  function (this: ConsolidationWorld, depth: number) {
    this.budgetCrossesAfterDepth = depth;
  },
);

Given(
  "depth {int} has {int} recent consecutive failure",
  function (this: ConsolidationWorld, depth: number, count: number) {
    const state = loadConsolidationState(this.buddyDir!);
    state.sessionsSinceLastDepth1 = 3;
    state.failures = {
      [String(depth)]: { count, lastFailureAt: TEST_FROZEN_NOW.toISOString() },
    };
    saveConsolidationState(this.buddyDir!, state);
  },
);

Given(
  "depth {int} has {int} consecutive failure from long ago",
  function (this: ConsolidationWorld, depth: number, count: number) {
    const state = loadConsolidationState(this.buddyDir!);
    state.sessionsSinceLastDepth1 = 3;
    const longAgo = new Date(TEST_FROZEN_NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    state.failures = {
      [String(depth)]: { count, lastFailureAt: longAgo.toISOString() },
    };
    saveConsolidationState(this.buddyDir!, state);
  },
);

Given(
  "depth {int} has reached the retry ceiling",
  function (this: ConsolidationWorld, depth: number) {
    const state = loadConsolidationState(this.buddyDir!);
    state.sessionsSinceLastDepth1 = 3;
    state.failures = {
      [String(depth)]: {
        count: CONSOLIDATION_RETRY_CEILING,
        lastFailureAt: TEST_FROZEN_NOW.toISOString(),
      },
    };
    saveConsolidationState(this.buddyDir!, state);
  },
);

When(
  "consolidation is triggered at depth {int}",
  async function (this: ConsolidationWorld, depth: number) {
    const state = loadConsolidationState(this.buddyDir!);
    state.sessionsSinceLastDepth1 = 3;
    if (depth >= 2) state.depth1RunsSinceLastDepth2 = 5;
    if (depth >= 3) state.depth2RunsSinceLastDepth3 = 4;
    saveConsolidationState(this.buddyDir!, state);
    await this.heartbeat!.tick();
  },
);

Then("depth {int} counters are persisted", function (this: ConsolidationWorld, depth: number) {
  const state = loadConsolidationState(this.buddyDir!);
  const stamp = depth === 1 ? state.lastDepth1 : depth === 2 ? state.lastDepth2 : state.lastDepth3;
  assert.ok(stamp, `depth ${depth} should have been persisted to disk`);
});

Then("depth {int} counters are not advanced", function (this: ConsolidationWorld, depth: number) {
  const state = loadConsolidationState(this.buddyDir!);
  const stamp = depth === 1 ? state.lastDepth1 : depth === 2 ? state.lastDepth2 : state.lastDepth3;
  assert.equal(stamp, null, `depth ${depth} must not be marked as completed`);
});

Then(
  "the failure count for depth {int} is {int}",
  function (this: ConsolidationWorld, depth: number, expected: number) {
    const state = loadConsolidationState(this.buddyDir!);
    assert.equal(depthFailureCount(state, depth as 1 | 2 | 3), expected);
  },
);

Then("a fail entry is appended to the consolidation log", function (this: ConsolidationWorld) {
  const log = loadConsolidationLog(this.buddyDir!);
  assert.ok(log.some((entry) => entry.status === "fail"));
});

Then(
  "a budget-stopped entry is appended to the consolidation log",
  function (this: ConsolidationWorld) {
    const log = loadConsolidationLog(this.buddyDir!);
    assert.ok(log.some((entry) => entry.status === "budget-stopped"));
  },
);

Then("only depth {int} runs", function (this: ConsolidationWorld, depth: number) {
  assert.deepEqual(this.consolidationRuns, [depth]);
});

Then("the user is told background maintenance is paused", function (this: ConsolidationWorld) {
  assert.ok(
    this.maintenancePausedNotices!.length > 0,
    "the user must be notified when maintenance is abandoned",
  );
});

// --- FR-CONSOL-10: the unattended session obeys the zone model ---
// Drives the real gate with the real policy, so the answer to "ask" is the
// production one, not a test double.

When(
  "the maintenance session tries to read {string}",
  async function (this: ConsolidationWorld, path: string) {
    const policy = createMaintenancePermissionPolicy();
    const gate = createPermissionGate(this.buddyDir!, policy.askUser, this.consolTmpDir!);
    this.maintenancePolicy = policy;
    this.maintenanceGateResult = await gate.check("read", {
      path: path.startsWith("~") ? path.replace("~", this.consolTmpDir!) : path,
    });
  },
);

When(
  "the maintenance session tries to write {string}",
  async function (this: ConsolidationWorld, path: string) {
    const policy = createMaintenancePermissionPolicy();
    const gate = createPermissionGate(this.buddyDir!, policy.askUser, this.consolTmpDir!);
    this.maintenancePolicy = policy;
    this.maintenanceGateResult = await gate.check("write", { path });
  },
);

Then("the maintenance tool call is blocked", function (this: ConsolidationWorld) {
  assert.ok(
    this.maintenanceGateResult?.block,
    `expected the call to be blocked, got: ${JSON.stringify(this.maintenanceGateResult)}`,
  );
});

Then("the maintenance tool call is allowed", function (this: ConsolidationWorld) {
  assert.equal(
    this.maintenanceGateResult,
    undefined,
    `expected the call to be allowed, got: ${JSON.stringify(this.maintenanceGateResult)}`,
  );
});

Then("the refusal is recorded in the run journal", function (this: ConsolidationWorld) {
  assert.ok(
    (this.maintenancePolicy?.refusedPaths() ?? []).length > 0,
    "a refused outside-workspace access must be recorded, not silently dropped",
  );
});
