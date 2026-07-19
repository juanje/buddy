// tests/steps/memory-loop.steps.ts — FR-GIT-01, FR-SESSION-03, FR-REFLECT-01/02/03.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { simpleGit } from "simple-git";

import { createAbInstance, defaultTemplatesDir } from "../../backends/create-ab";
import { findPendingReflects, parseFrontmatter, saveSessionSkeleton } from "../../backends/reflect";
import { runCrashRecoveryCatchUp } from "../../backends/reflect-recovery";
import type { SpawnReflectOptions } from "../../backends/reflect-spawn";
import { SessionTracker } from "../../backends/session-tracker";
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

function sessionLogFiles(abDir: string): string[] {
  const logsDir = join(abDir, "logs");
  if (!existsSync(logsDir)) return [];
  return readdirSync(logsDir).filter((f) => f.endsWith(".md") && f !== "index.md");
}

Given("an initialized AB git repository", async function (this: MemoryWorld) {
  this.memoryTmpDir = mkdtempSync(join(tmpdir(), "ab-memory-"));
  this.abDir = join(this.memoryTmpDir, "my-ab");
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

Given("incremental reflect runs every {int} turns", function (this: MemoryWorld, n: number) {
  this.connect(this.abDir, { incrementalEvery: n, force: true });
});

Given("a pending session log exists", function (this: MemoryWorld) {
  const tracker = new SessionTracker("pending-1");
  tracker.filesWritten.push("user/inbox.md");
  saveSessionSkeleton(this.abDir!, tracker.toSnapshot());
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
  assert.ok(pending.length > 0, "expected at least one reflect-pending log");
});

Then("a reflect child spawn is requested for each pending log", function (this: MemoryWorld) {
  const pending = findPendingReflects(this.abDir!);
  assert.equal(this.spawnCalls?.length ?? 0, pending.length);
  for (const call of this.spawnCalls ?? []) {
    assert.equal(call.mode, "crash-catchup");
    assert.equal(call.abDirectory, this.abDir);
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

Then("a session log exists with status {string}", function (this: MemoryWorld, status: string) {
  const files = sessionLogFiles(this.abDir!);
  assert.ok(files.length > 0, "expected a session log file");
  const content = readFileSync(join(this.abDir!, "logs", files[0]), "utf8");
  assert.equal(parseFrontmatter(content).status, status);
});

Then("the session logs index lists the session", function (this: MemoryWorld) {
  const index = readFileSync(join(this.abDir!, "logs", "index.md"), "utf8");
  assert.match(index, /reflect-pending|complete/);
});

Then("the session log status is {string}", function (this: MemoryWorld, status: string) {
  const file = sessionLogFiles(this.abDir!).find((f) => f.includes("pending"));
  assert.ok(file, "pending session log not found");
  const content = readFileSync(join(this.abDir!, "logs", file!), "utf8");
  assert.equal(parseFrontmatter(content).status, status);
});

Then("the session log contains {string}", function (this: MemoryWorld, text: string) {
  const file = sessionLogFiles(this.abDir!).find((f) => f.includes("pending"));
  assert.ok(file, "pending session log not found");
  const content = readFileSync(join(this.abDir!, "logs", file!), "utf8");
  assert.match(content, new RegExp(text));
});

Then("an incremental snapshot exists for turn {int}", function (this: MemoryWorld, turn: number) {
  const dir = join(this.abDir!, ".ab-app", "snapshots");
  assert.ok(existsSync(dir), "snapshots dir should exist");
  const file = readdirSync(dir).find((f) => f.endsWith(`_${turn}.md`));
  assert.ok(file, `expected snapshot for turn ${turn}`);
});

Then("an incremental snapshot exists", function (this: MemoryWorld) {
  const dir = join(this.abDir!, ".ab-app", "snapshots");
  assert.ok(existsSync(dir), "snapshots dir should exist");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0, "expected at least one snapshot");
});
