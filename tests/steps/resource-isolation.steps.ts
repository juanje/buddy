// tests/steps/resource-isolation.steps.ts — NFR-SEC-21 SDK resource isolation.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import {
  APPEND_SYSTEM_MARKER,
  captureChatSystemPrompt,
  captureMaintenanceSystemPrompt,
  captureReflectSystemPrompt,
  captureWikiSynthesisSystemPrompt,
  createTestModelRuntime,
  DECOY_SKILL_MARKER,
  installResourceLeakDecoys,
  PARENT_AGENTS_MARKER,
  prepareBuddyRoot,
  ROOT_AGENTS_MARKER,
  WIKI_SYNTHESIS_INSTRUCTION,
} from "../support/resource-isolation-capture";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

interface ResourceIsolationWorld {
  tmpDir?: string;
  homeDir?: string;
  parentDir?: string;
  rootDir?: string;
  globalConfigDir?: string;
  previousHome?: string;
  modelRuntime?: ModelRuntime;
  systemPrompt?: string;
  forkFile?: string;
}

After(function (this: ResourceIsolationWorld) {
  if (this.previousHome !== undefined) process.env.HOME = this.previousHome;
  else delete process.env.HOME;
  teardownGlobalConfigDir(this.globalConfigDir);
  if (this.tmpDir) rmSync(this.tmpDir, { recursive: true, force: true });
});

Given("a buddy instance with SDK leak decoys in cwd, parents, and home", async function (this: ResourceIsolationWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir({
    agentsBase: "# Base\n\nBuddy base prompt.\n",
    consolidationSkill: "# Skill\n\nConsolidation skill.\n",
  }));

  this.tmpDir = mkdtempSync(join(tmpdir(), "buddy-resource-iso-"));
  this.homeDir = mkdtempSync(join(tmpdir(), "buddy-resource-home-"));
  this.previousHome = process.env.HOME;
  process.env.HOME = this.homeDir;

  this.parentDir = join(this.tmpDir, "parent");
  this.rootDir = join(this.parentDir, "buddy-root");
  mkdirSync(this.rootDir, { recursive: true });

  installResourceLeakDecoys(this.parentDir, this.rootDir, this.homeDir);
  await prepareBuddyRoot(this.rootDir);
  this.modelRuntime = await createTestModelRuntime();
});

When("the chat agent session is created", async function (this: ResourceIsolationWorld) {
  assert.ok(this.rootDir && this.modelRuntime);
  this.systemPrompt = await captureChatSystemPrompt(this.rootDir, this.modelRuntime);
});

When("the consolidation agent session is created", async function (this: ResourceIsolationWorld) {
  assert.ok(this.rootDir && this.modelRuntime);
  this.systemPrompt = await captureMaintenanceSystemPrompt(this.rootDir, this.modelRuntime);
});

When("the wiki synthesis agent session is created", async function (this: ResourceIsolationWorld) {
  assert.ok(this.rootDir && this.modelRuntime);
  this.systemPrompt = await captureWikiSynthesisSystemPrompt(this.rootDir, this.modelRuntime);
});

When("the reflect agent session is created", async function (this: ResourceIsolationWorld) {
  assert.ok(this.rootDir && this.modelRuntime);
  this.forkFile = join(this.rootDir, ".buddy", "reflect-sessions", "fork.jsonl");
  mkdirSync(join(this.rootDir, ".buddy", "reflect-sessions"), { recursive: true });
  writeFileSync(this.forkFile, '{"type":"session","version":3,"id":"fork","timestamp":0,"cwd":"/tmp"}\n', "utf8");
  this.systemPrompt = await captureReflectSystemPrompt(this.rootDir, this.modelRuntime, this.forkFile);
});

Then(
  "the session system prompt contains the root AGENTS marker exactly once",
  function (this: ResourceIsolationWorld) {
    assert.ok(this.systemPrompt);
    const count = this.systemPrompt.split(ROOT_AGENTS_MARKER).length - 1;
    assert.equal(count, 1, `expected ROOT marker once, found ${count}`);
  },
);

Then("the session system prompt does not contain the root AGENTS marker", function (this: ResourceIsolationWorld) {
  assert.ok(this.systemPrompt);
  assert.ok(
    !this.systemPrompt.includes(ROOT_AGENTS_MARKER),
    "root AGENTS marker must not appear in maintenance/reflect prompts",
  );
});

Then(
  "the session system prompt does not contain the parent AGENTS marker",
  function (this: ResourceIsolationWorld) {
    assert.ok(this.systemPrompt);
    assert.ok(!this.systemPrompt.includes(PARENT_AGENTS_MARKER));
  },
);

Then(
  "the session system prompt does not contain the append-system marker",
  function (this: ResourceIsolationWorld) {
    assert.ok(this.systemPrompt);
    assert.ok(!this.systemPrompt.includes(APPEND_SYSTEM_MARKER));
  },
);

Then("the session system prompt does not advertise decoy skills", function (this: ResourceIsolationWorld) {
  assert.ok(this.systemPrompt);
  assert.ok(!this.systemPrompt.includes(DECOY_SKILL_MARKER));
  assert.ok(!this.systemPrompt.includes("proj-skill"));
  assert.ok(!this.systemPrompt.includes("home-skill"));
});

Then("the session system prompt is the wiki synthesis instruction only", function (this: ResourceIsolationWorld) {
  assert.ok(this.systemPrompt);
  assert.equal(this.systemPrompt.trim(), WIKI_SYNTHESIS_INSTRUCTION);
});
