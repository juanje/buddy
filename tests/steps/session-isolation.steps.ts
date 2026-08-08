// tests/steps/session-isolation.steps.ts — NFR-SEC-19 session file isolation BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { buddySessionsDir } from "../../backends/session-paths";
import { pruneSessionArtifacts } from "../../backends/session-log-prune";
import { SESSIONS_DIR } from "../../shared/defaults";
import { MS_PER_DAY } from "../../shared/dates";

interface SessionIsolationWorld {
  rootDir?: string;
  sessionsDir?: string;
  pruneNow?: number;
}

After(function (this: SessionIsolationWorld) {
  if (this.rootDir) rmSync(this.rootDir, { recursive: true, force: true });
});

Given("a configured buddy instance", function (this: SessionIsolationWorld) {
  this.rootDir = mkdtempSync(join(tmpdir(), "buddy-session-iso-"));
  mkdirSync(join(this.rootDir, "agent_brain"), { recursive: true });
});

When("a new session is created", function (this: SessionIsolationWorld) {
  assert.ok(this.rootDir, "buddy instance root");
  this.sessionsDir = buddySessionsDir(this.rootDir);
  mkdirSync(this.sessionsDir, { recursive: true });
});

Then("the session directory is inside the buddy root", function (this: SessionIsolationWorld) {
  assert.ok(this.rootDir && this.sessionsDir);
  const resolvedRoot = resolve(this.rootDir);
  const resolvedSessions = resolve(this.sessionsDir);
  assert.ok(
    resolvedSessions.startsWith(resolvedRoot + "/") || resolvedSessions.startsWith(resolvedRoot + "\\"),
    `expected ${resolvedSessions} under ${resolvedRoot}`,
  );
  assert.equal(this.sessionsDir, join(this.rootDir, SESSIONS_DIR));
});

Then("the session directory is not under the Pi CLI agent directory", function (this: SessionIsolationWorld) {
  assert.ok(this.sessionsDir);
  const piSessions = join(homedir(), ".pi", "agent", "sessions");
  const resolved = resolve(this.sessionsDir);
  assert.ok(
    !resolved.startsWith(resolve(piSessions)),
    `session dir must not be under Pi CLI sessions: ${resolved}`,
  );
  assert.ok(!resolved.includes("/.pi/"), `session dir must not contain /.pi/: ${resolved}`);
});

Given("a buddy instance with session files older than 7 days", function (this: SessionIsolationWorld) {
  this.rootDir = mkdtempSync(join(tmpdir(), "buddy-session-prune-"));
  this.pruneNow = Date.parse("2026-07-27T12:00:00Z");
  const sessionsDir = join(this.rootDir, SESSIONS_DIR);
  mkdirSync(sessionsDir, { recursive: true });

  const writeAged = (name: string, ageDays: number) => {
    const path = join(sessionsDir, name);
    writeFileSync(path, '{"type":"session"}\n', "utf8");
    const when = new Date(this.pruneNow! - ageDays * MS_PER_DAY);
    utimesSync(path, when, when);
  };

  writeAged("expired.jsonl", 30);
  writeAged("recent.jsonl", 1);
});

When("session artifact pruning runs", function (this: SessionIsolationWorld) {
  assert.ok(this.rootDir && this.pruneNow !== undefined);
  pruneSessionArtifacts(this.rootDir, this.pruneNow);
});

Then("the expired session files are removed", function (this: SessionIsolationWorld) {
  assert.ok(this.rootDir);
  const names = readdirSync(join(this.rootDir, SESSIONS_DIR));
  assert.ok(!names.includes("expired.jsonl"));
});

Then("recent session files are kept", function (this: SessionIsolationWorld) {
  assert.ok(this.rootDir);
  const names = readdirSync(join(this.rootDir, SESSIONS_DIR));
  assert.deepEqual(names, ["recent.jsonl"]);
});
