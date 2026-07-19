// tests/steps/session-resume.steps.ts — FR-SESSION-01 resume last session.
// Uses the real Pi SessionManager against a temp session dir (never the
// user's ~/.pi). No LLM involved: persistence is plain file I/O.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";

import { resumeOrCreateSession } from "../../backends/session-resume";
import type { AbWorld } from "../support/world";

interface ResumeWorld extends AbWorld {
  resumeTmpDir?: string;
  sessionDir?: string;
  abCwd?: string;
  resumed?: SessionManager;
}

After(function (this: ResumeWorld) {
  if (this.resumeTmpDir) rmSync(this.resumeTmpDir, { recursive: true, force: true });
});

function scratch(world: ResumeWorld): void {
  world.resumeTmpDir = mkdtempSync(join(tmpdir(), "ab-resume-"));
  world.sessionDir = join(world.resumeTmpDir, "sessions");
  world.abCwd = join(world.resumeTmpDir, "my-ab");
  // The cwd must exist: continueRecent matches session headers by realpath.
  mkdirSync(world.abCwd, { recursive: true });
}

Given("a previous session with messages exists for the AB", function (this: ResumeWorld) {
  scratch(this);
  const previous = SessionManager.create(this.abCwd!, this.sessionDir!);
  previous.appendMessage({
    role: "user",
    content: [{ type: "text", text: "recuerda: mi color favorito es el verde" }],
    timestamp: Date.now(),
  });
  // Sessions only flush to disk once an assistant message lands (pi skips
  // persisting empty sessions), so the seed needs a full exchange.
  previous.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: "Anotado: verde." }],
    api: "anthropic-messages",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  } as never);
});

Given("no previous session exists for the AB", function (this: ResumeWorld) {
  scratch(this); // session dir never written
});

When("the worker initializes its session manager", function (this: ResumeWorld) {
  this.resumed = resumeOrCreateSession(this.abCwd!, this.sessionDir!);
});

Then("the most recent session is resumed", function (this: ResumeWorld) {
  assert.ok(this.resumed!.getSessionId(), "resumed session should have an id");
  assert.ok(this.resumed!.getBranch().length > 0, "resumed session should carry entries");
});

Then("the prior conversation messages are present", function (this: ResumeWorld) {
  const texts = JSON.stringify(this.resumed!.getBranch());
  assert.match(texts, /mi color favorito es el verde/);
});

Then("a new empty session is started", function (this: ResumeWorld) {
  assert.equal(this.resumed!.getBranch().length, 0);
});
