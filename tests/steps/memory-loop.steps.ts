// tests/steps/memory-loop.steps.ts — FR-GIT-01, FR-SESSION-03, FR-REFLECT-02/03.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { simpleGit } from "simple-git";

import { createAbInstance, defaultTemplatesDir } from "../../backends/create-buddy";
import type { SetupConfig } from "../../shared/api";
import type { AbWorld } from "../support/world";

interface MemoryWorld extends AbWorld {
  memoryTmpDir?: string;
  abDir?: string;
}

After(function (this: MemoryWorld) {
  if (this.memoryTmpDir) rmSync(this.memoryTmpDir, { recursive: true, force: true });
});

Given("an initialized buddy git repository", async function (this: MemoryWorld) {
  this.memoryTmpDir = mkdtempSync(join(tmpdir(), "ab-memory-"));
  this.abDir = join(this.memoryTmpDir, "buddy");
  const config: SetupConfig = {
    rootDir: this.abDir,
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
  this.connect(this.abDir, { force: true, trackSpawn: true });
});

Given("memory lifecycle is tracking reflect spawns", function (this: MemoryWorld) {
  this.connect(this.abDir, { force: true, trackSpawn: true });
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

When("the agent completes {int} turns with activity", async function (this: MemoryWorld, n: number) {
  for (let i = 0; i < n; i++) {
    const fullPath = join(this.abDir!, `user/turn-${i}.md`);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, `# turn ${i}\n`, "utf8");
    this.session.emitToolExecutionEnd("write", fullPath);
    this.session.endStreaming();
    await this.lifecycle?.flush();
  }
});

Then("the buddy repository has a new commit", async function (this: MemoryWorld) {
  const log = await simpleGit(this.abDir!).log();
  assert.ok(log.total > 1, "expected more than the initial setup commit");
});

Then("the latest commit message starts with {string}", async function (this: MemoryWorld, prefix: string) {
  const log = await simpleGit(this.abDir!).log({ maxCount: 1 });
  assert.ok(log.latest?.message.startsWith(prefix), log.latest?.message ?? "no commit");
});

When("compaction starts", async function (this: MemoryWorld) {
  this.session.emitCompactionStart();
  await this.lifecycle?.flush();
});

Then("a checkpoint reflect spawn was requested", function (this: MemoryWorld) {
  const calls = (this.spawnCalls ?? []).filter((call) => call.mode === "checkpoint");
  assert.ok(calls.length > 0, "expected a checkpoint reflect spawn");
});

Then("no checkpoint reflect was spawned", function (this: MemoryWorld) {
  const calls = (this.spawnCalls ?? []).filter((call) => call.mode === "checkpoint");
  assert.equal(calls.length, 0, "expected no checkpoint reflect spawn");
});
