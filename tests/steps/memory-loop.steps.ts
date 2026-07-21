// tests/steps/memory-loop.steps.ts — FR-GIT-01, FR-SESSION-03, FR-REFLECT-01/02/03.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { simpleGit } from "simple-git";

import { createAbInstance, defaultTemplatesDir } from "../../backends/create-ab";
import { findPendingReflects, parseFrontmatter, savePendingSkeleton } from "../../backends/reflect";
import { runCrashRecoveryCatchUp } from "../../backends/reflect-recovery";
import type { SpawnReflectOptions } from "../../backends/reflect-spawn";
import { SessionTracker } from "../../backends/session-tracker";
import { PENDING_DIR } from "../../shared/defaults";
import type { SetupConfig } from "../../shared/api";
import type { AbWorld } from "../support/world";

interface MemoryWorld extends AbWorld {
  memoryTmpDir?: string;
  abDir?: string;
  spawnCalls?: SpawnReflectOptions[];
}

After(function (this: MemoryWorld) {
  if (this.memoryTmpDir) rmSync(this.memoryTmpDir, { recursive: true, force: true });
});

Given("an initialized AB git repository", async function (this: MemoryWorld) {
  this.memoryTmpDir = mkdtempSync(join(tmpdir(), "ab-memory-"));
  this.abDir = join(this.memoryTmpDir, "buddy");
  const config: SetupConfig = {
    abDirectory: this.abDir,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    language: "en",
    name: "Test",
  };
  await createAbInstance({
    config,
    configPath: join(this.memoryTmpDir, "config.json"),
    templatesDir: defaultTemplatesDir(),
  });
});

Given("the app is running with memory lifecycle enabled", function (this: MemoryWorld) {
  this.connect(this.abDir, { force: true });
});

Given("checkpoint reflect runs every {int} turns", function (this: MemoryWorld, n: number) {
  this.connect(this.abDir, { incrementalEvery: n, force: true, trackSpawn: true });
});

Given("a pending reflect skeleton exists", function (this: MemoryWorld) {
  const tracker = new SessionTracker("pending-1");
  tracker.filesWritten.push("user/inbox.md");
  savePendingSkeleton(this.abDir!, tracker.toSnapshot());
});

When("the agent writes file {string}", async function (this: MemoryWorld, relPath: string) {
  const fullPath = join(this.abDir!, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, "# updated by agent\n", "utf8");
  this.session.emitToolExecutionEnd("write", fullPath);
  await this.lifecycle?.flush();
});

When("the agent turn ends", async function (this: MemoryWorld) {
  this.session.endStreaming();
  await this.lifecycle?.flush();
});

When("the app shuts down", async function (this: MemoryWorld) {
  await this.core.api.shutdown();
});

When("crash recovery runs at boot", function (this: MemoryWorld) {
  this.spawnCalls = [];
  runCrashRecoveryCatchUp(this.abDir!, (options) => {
    this.spawnCalls!.push(options);
    return 12345;
  });
});

Then("pending reflects are detected", function (this: MemoryWorld) {
  const pending = findPendingReflects(this.abDir!);
  assert.ok(pending.length > 0, "expected at least one reflect-pending skeleton");
});

Then("a reflect child spawn is requested for each pending skeleton", function (this: MemoryWorld) {
  const pending = findPendingReflects(this.abDir!);
  assert.equal(this.spawnCalls?.length ?? 0, pending.length);
  for (const call of this.spawnCalls ?? []) {
    assert.equal(call.mode, "crash-catchup");
    assert.equal(call.abDirectory, this.abDir);
    assert.ok(call.logPath.includes(PENDING_DIR));
    assert.ok(call.logPath.endsWith(".md"));
  }
});

When("compaction starts", async function (this: MemoryWorld) {
  this.session.emitCompactionStart();
  await this.lifecycle?.flush();
});

Then("the AB repository has a new commit", async function (this: MemoryWorld) {
  const log = await simpleGit(this.abDir!).log();
  assert.ok(log.total > 1, "expected more than the initial setup commit");
});

Then("the latest commit message starts with {string}", async function (this: MemoryWorld, prefix: string) {
  const log = await simpleGit(this.abDir!).log({ maxCount: 1 });
  assert.ok(log.latest?.message.startsWith(prefix), log.latest?.message ?? "no commit");
});

Then("a pending reflect skeleton exists with status {string}", function (this: MemoryWorld, status: string) {
  const pending = findPendingReflects(this.abDir!);
  assert.ok(pending.length > 0, "expected a pending reflect skeleton");
  const content = readFileSync(pending[0].path, "utf8");
  assert.equal(parseFrontmatter(content).status, status);
});

Then("a checkpoint reflect spawn was requested at turn {int}", function (this: MemoryWorld, turn: number) {
  const calls = (this.spawnCalls ?? []).filter((call) => call.mode === "checkpoint");
  assert.ok(calls.length > 0, "expected a checkpoint reflect spawn");
  assert.equal(this.lifecycle?.tracker.turnCount, turn);
  assert.equal(calls[0].logPath, "");
  assert.ok(calls[0].checkpointDate);
  assert.ok(calls[0].checkpointTime);
});

Then("a checkpoint reflect spawn was requested", function (this: MemoryWorld) {
  const calls = (this.spawnCalls ?? []).filter((call) => call.mode === "checkpoint");
  assert.ok(calls.length > 0, "expected a checkpoint reflect spawn");
  assert.equal(calls[0].logPath, "");
});
