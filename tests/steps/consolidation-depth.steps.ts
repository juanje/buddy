// tests/steps/consolidation-depth.steps.ts — FR-CONSOL-17..20, 22 BDD steps.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  advanceCounters,
  defaultConsolidationState,
  loadConsolidationState,
  saveConsolidationState,
} from "../../shared/consolidation-state";
import { buildSkillTools, executeSkillTool } from "../../backends/skill-tools";
import {
  computeDailyCoherence,
  formatDailyCoherenceBlock,
} from "../../backends/daily-coherence";
import {
  computeWeeklyDiff,
  extractRightNowSection,
  formatWeeklyDiffBlock,
  snapshotForDiff,
} from "../../backends/consolidation-snapshot";
import {
  computeStaleObservations,
  parseObservations,
  runObservationHygiene,
} from "../../backends/observation-hygiene";
import {
  detectGroupingCandidates,
} from "../../backends/grouping-candidates";
import { toIsoDay, toLocalIsoStamp } from "../../shared/dates";
import type { BuddyWorld } from "../support/world";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

interface DepthWorld extends BuddyWorld {
  depthTmpDir?: string;
  globalConfigDir?: string;
  buddyDir?: string;
  stale?: ReturnType<typeof computeStaleObservations>;
  hygieneRemoved?: number;
  coherence?: ReturnType<typeof computeDailyCoherence>;
  weeklyDiffBlock?: string;
  groupingCandidates?: ReturnType<typeof detectGroupingCandidates>;
}

After(function (this: DepthWorld) {
  teardownGlobalConfigDir(this.globalConfigDir);
  if (this.depthTmpDir) rmSync(this.depthTmpDir, { recursive: true, force: true });
});

Given("a buddy directory prepared for consolidation depth features", function (this: DepthWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir({
    consolidationSkill: "# Skill\n\nConsolidate.\n",
  }));
  const promptsDir = join(this.globalConfigDir!, "prompts");
  writeFileSync(join(promptsDir, "process-conversation.md"), "# Process\n");
  writeFileSync(join(promptsDir, "triage-inbox.md"), "# Triage\n");
  this.depthTmpDir = mkdtempSync(join(tmpdir(), "buddy-depth-bdd-"));
  this.buddyDir = join(this.depthTmpDir, "buddy");
  mkdirSync(join(this.buddyDir, "agent_brain"), { recursive: true });
  writeFileSync(join(this.buddyDir, "AGENTS.md"), "## Active context\n\n### Right now\n- placeholder\n");
  saveConsolidationState(this.buddyDir, defaultConsolidationState());
});

When('the "process_conversation" skill tool is invoked', async function (this: DepthWorld) {
  const tools = buildSkillTools(join(this.globalConfigDir!, "prompts"), { rootDir: this.buddyDir });
  await executeSkillTool(tools, "process_conversation");
});

Then("consolidation state has skillUsage.process_conversation.lastInvoked set to today", function (this: DepthWorld) {
  const state = loadConsolidationState(this.buddyDir!);
  const today = toIsoDay(new Date());
  assert.match(state.skillUsage?.process_conversation.lastInvoked ?? "", new RegExp(`^${today}T`));
});

Then("skillUsage.process_conversation.totalInvocations is {int}", function (this: DepthWorld, count: number) {
  const state = loadConsolidationState(this.buddyDir!);
  assert.equal(state.skillUsage?.process_conversation.totalInvocations, count);
});

Given("skillUsage.triage_inbox.invokedThisPeriod is {int}", function (this: DepthWorld, count: number) {
  const state = loadConsolidationState(this.buddyDir!);
  state.skillUsage = {
    triage_inbox: {
      lastInvoked: "2026-08-10T10:00",
      invokedThisPeriod: count,
      totalInvocations: 10,
    },
  };
  saveConsolidationState(this.buddyDir!, state);
});

When("consolidation counters advance at depth {int}", function (this: DepthWorld, depth: number) {
  const state = loadConsolidationState(this.buddyDir!);
  advanceCounters(state, depth as 1 | 2 | 3, new Date("2026-08-17T12:00:00Z"));
  if (depth === 2) {
    state.lastDepth2Snapshot = snapshotForDiff(this.buddyDir!, new Date("2026-08-17T12:00:00Z"));
  }
  saveConsolidationState(this.buddyDir!, state);
});

Then("skillUsage.triage_inbox.invokedThisPeriod should be {int}", function (this: DepthWorld, count: number) {
  const state = loadConsolidationState(this.buddyDir!);
  assert.equal(state.skillUsage?.triage_inbox.invokedThisPeriod, count);
});

Given('observations.md contains an entry referencing {string}', function (this: DepthWorld, relPath: string) {
  writeFileSync(
    join(this.buddyDir!, "agent_brain", "observations.md"),
    `## Skill candidates\n\n- **2026-08-01:** Missing [skill](${relPath}) (seen: 1)\n`,
  );
});

Given("{string} does not exist in the instance", function (_relPath: string) {
  // fixture relies on the path not being created
});

Given("{string} exists in the instance", function (this: DepthWorld, relPath: string) {
  const fullPath = join(this.buddyDir!, "agent_brain", relPath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, "# exists\n");
});

Given("observations.md contains a resolved entry dated 80 days ago", function (this: DepthWorld) {
  writeFileSync(
    join(this.buddyDir!, "agent_brain", "observations.md"),
    `## Rule candidates\n\n- **2026-05-01:** Old rule → **resolved 2026-05-02** (seen: 2)\n`,
  );
});

When("observation hygiene runs", function (this: DepthWorld) {
  const result = runObservationHygiene(this.buddyDir!, new Date("2026-08-17T12:00:00Z"));
  this.hygieneRemoved = result.removedCount;
  this.stale = result.stale;
});

When("stale observations are computed", function (this: DepthWorld) {
  const content = readFileSync(join(this.buddyDir!, "agent_brain", "observations.md"), "utf8");
  this.stale = computeStaleObservations(parseObservations(content), this.buddyDir!, new Date("2026-08-17T12:00:00Z"));
});

Then("the entry is removed from observations.md", function (this: DepthWorld) {
  const content = readFileSync(join(this.buddyDir!, "agent_brain", "observations.md"), "utf8");
  assert.doesNotMatch(content, /missing-skill/);
});

Then("removed count is {int}", function (this: DepthWorld, count: number) {
  assert.equal(this.hygieneRemoved, count);
});

Then('the entry appears in the "resolvedOlderThan60d" list', function (this: DepthWorld) {
  assert.ok((this.stale?.resolvedOlderThan60d.length ?? 0) > 0);
});

Then("the entry is not removed", function (this: DepthWorld) {
  const content = readFileSync(join(this.buddyDir!, "agent_brain", "observations.md"), "utf8");
  assert.match(content, /concepts\/index\.md/);
});

Then("consolidation state contains lastDepth2Snapshot.userMdHash", function (this: DepthWorld) {
  const state = loadConsolidationState(this.buddyDir!);
  assert.ok(state.lastDepth2Snapshot?.userMdHash);
});

Then('lastDepth2Snapshot.rightNowContent matches current "Right now"', function (this: DepthWorld) {
  const state = loadConsolidationState(this.buddyDir!);
  const current = extractRightNowSection(readFileSync(join(this.buddyDir!, "AGENTS.md"), "utf8"));
  assert.equal(state.lastDepth2Snapshot?.rightNowContent, current);
});

Given("a previous depth-2 snapshot exists", function (this: DepthWorld) {
  const state = loadConsolidationState(this.buddyDir!);
  state.lastDepth2Snapshot = snapshotForDiff(this.buddyDir!, new Date("2026-08-10T12:00:00Z"));
  state.lastDepth2 = toLocalIsoStamp(new Date("2026-08-10T12:00:00Z"));
  saveConsolidationState(this.buddyDir!, state);
});

Given("USER.md has changed since the snapshot", function (this: DepthWorld) {
  mkdirSync(join(this.buddyDir!, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(this.buddyDir!, "agent_brain", "identity", "USER.md"), "updated user model\n");
});

When("the weekly diff block is computed", async function (this: DepthWorld) {
  const state = loadConsolidationState(this.buddyDir!);
  const diff = await computeWeeklyDiff(this.buddyDir!, state.lastDepth2Snapshot, state.lastDepth2);
  this.weeklyDiffBlock = formatWeeklyDiffBlock(diff);
});

Then("the block contains a USER.md diff section", function (this: DepthWorld) {
  assert.match(this.weeklyDiffBlock ?? "", /USER\.md/);
});

Given('AGENTS.md Right now mentions "Project Alpha Phase 1 next"', function (this: DepthWorld) {
  writeFileSync(
    join(this.buddyDir!, "AGENTS.md"),
    "## Active context\n\n### Right now\n- Project Alpha Phase 1 next\n",
  );
});

Given("today's log mentions Project Alpha Phase 1 complete", function (this: DepthWorld) {
  mkdirSync(join(this.buddyDir!, "logs"), { recursive: true });
  writeFileSync(
    join(this.buddyDir!, "logs", "2026-08-17.md"),
    "### Decisions\n- Project Alpha Phase 1 complete and shipped\n",
  );
});

Given('deferred.md contains "investigate native menu rendering"', function (this: DepthWorld) {
  writeFileSync(
    join(this.buddyDir!, "agent_brain", "deferred.md"),
    "- **decision** (2026-08-16, daily): investigate native menu rendering\n",
  );
});

Given("today's log mentions native menu rendering resolved", function (this: DepthWorld) {
  mkdirSync(join(this.buddyDir!, "logs"), { recursive: true });
  writeFileSync(
    join(this.buddyDir!, "logs", "2026-08-17.md"),
    "### Decisions\n- Native menu rendering resolved after upgrading to latest version\n",
  );
});

Given("no coherence divergence fixtures", function (this: DepthWorld) {
  writeFileSync(join(this.buddyDir!, "AGENTS.md"), "## Active context\n\n### Right now\n- stable item\n");
});

When("daily coherence is computed", function (this: DepthWorld) {
  this.coherence = computeDailyCoherence(this.buddyDir!, new Date("2026-08-17T12:00:00Z"));
});

When("the daily coherence block is formatted", function (this: DepthWorld) {
  this.coherence = computeDailyCoherence(this.buddyDir!, new Date("2026-08-17T12:00:00Z"));
});

Then("a staleness flag is present", function (this: DepthWorld) {
  assert.ok((this.coherence?.stalenessFlags.length ?? 0) > 0);
});

Then("a resolved deferred flag is present", function (this: DepthWorld) {
  assert.ok((this.coherence?.resolvedDeferred.length ?? 0) > 0);
});

Then("the block reports no divergence detected", function (this: DepthWorld) {
  const block = formatDailyCoherenceBlock(this.coherence!);
  assert.match(block, /No staleness or deferred-resolution flags detected/);
});

Given('3 concept files share the keyword "memory" in their summaries', function (this: DepthWorld) {
  const concepts = join(this.buddyDir!, "agent_brain", "concepts");
  mkdirSync(concepts, { recursive: true });
  for (let i = 1; i <= 3; i += 1) {
    writeFileSync(
      join(concepts, `memory-file-${i}.md`),
      `---\nsummary: agent memory pattern ${i}\ncreated: 2026-08-01\n---\n`,
    );
  }
});

When("grouping candidates are computed", function (this: DepthWorld) {
  this.groupingCandidates = detectGroupingCandidates(this.buddyDir!);
});

Then('a grouping candidate for "memory" is present', function (this: DepthWorld) {
  assert.ok(this.groupingCandidates?.some((candidate) => candidate.keyword === "memory"));
});
