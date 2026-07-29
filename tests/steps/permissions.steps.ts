// tests/steps/permissions.steps.ts — FR-PERM-01..04 permission zones.
// Drives the real permission gate with a scripted user; paths live under a
// temp "home" so the denylist rules are exercised for real. No LLM.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPermissionGate,
  type PermissionGate,
  type PermissionRequest,
} from "../../backends/permissions";
import type { BuddyWorld } from "../support/world";

interface PermWorld extends BuddyWorld {
  permTmpDir?: string;
  home?: string;
  buddyDir?: string;
  gate?: PermissionGate;
  asked: Array<Omit<PermissionRequest, "id">>;
  nextAnswer?: boolean;
  pending?: Promise<{ block: true; reason: string } | undefined>;
  outcome?: { block: true; reason: string } | undefined;
}

After(function (this: PermWorld) {
  if (this.permTmpDir) rmSync(this.permTmpDir, { recursive: true, force: true });
});

Given("a permission layer for a buddy directory", function (this: PermWorld) {
  this.permTmpDir = mkdtempSync(join(tmpdir(), "buddy-perm-"));
  this.home = join(this.permTmpDir, "home");
  this.buddyDir = join(this.home, "buddy");
  this.asked = [];
  this.gate = createPermissionGate(
    this.buddyDir,
    async (request) => {
      this.asked.push(request);
      // Wait for the scenario to script the answer (default: undecided).
      while (this.nextAnswer === undefined) {
        await new Promise((r) => setTimeout(r, 1));
      }
      const answer = this.nextAnswer;
      this.nextAnswer = undefined;
      return answer;
    },
    this.home,
  );
});

function expand(world: PermWorld, path: string): string {
  return path.startsWith("~/") ? join(world.home!, path.slice(2)) : path;
}

When("the agent reads {string}", async function (this: PermWorld, relPath: string) {
  this.outcome = await this.gate!.check("read", { path: join(this.buddyDir!, relPath) });
});

When("the agent writes {string}", async function (this: PermWorld, relPath: string) {
  // Identity confirmations block until the scenario answers; keep the
  // promise pending so "Then the user is asked" can observe the question.
  this.pending = this.gate!.check("write", { path: join(this.buddyDir!, relPath) });
  // Give an immediate decision (allow/deny without asking) a chance to settle.
  await new Promise((r) => setTimeout(r, 5));
});

When("the agent reads the outside path {string}", async function (this: PermWorld, path: string) {
  this.pending = this.gate!.check("read", { path: expand(this, path) });
  await new Promise((r) => setTimeout(r, 5));
});

When("the agent lists files without a path", async function (this: PermWorld) {
  this.outcome = await this.gate!.check("ls", {});
});

When("the user confirms", async function (this: PermWorld) {
  this.nextAnswer = true;
  this.outcome = await this.pending!;
});

When("the user allows once", async function (this: PermWorld) {
  this.nextAnswer = true;
  this.outcome = await this.pending!;
});

When("the user declines", async function (this: PermWorld) {
  this.nextAnswer = false;
  this.outcome = await this.pending!;
});

Then("both operations proceed without asking the user", async function (this: PermWorld) {
  assert.equal(this.outcome, undefined);
  assert.equal(await this.pending, undefined);
  assert.equal(this.asked.length, 0);
});

Then("the operation proceeds without asking the user", function (this: PermWorld) {
  assert.equal(this.outcome, undefined);
  assert.equal(this.asked.length, 0);
});

Then("the user is asked to confirm an identity write", function (this: PermWorld) {
  assert.equal(this.asked.length, 1);
  assert.equal(this.asked[0].kind, "identity-write");
  assert.equal(this.asked[0].op, "write");
});

Then("the user is asked for outside access", function (this: PermWorld) {
  assert.equal(this.asked.length, 1);
  assert.equal(this.asked[0].kind, "outside");
});

Then("the operation proceeds", function (this: PermWorld) {
  assert.equal(this.outcome, undefined);
});

Then("the operation is blocked", async function (this: PermWorld) {
  const outcome = this.outcome ?? (await this.pending);
  assert.ok(outcome?.block, "expected the tool call to be blocked");
});

Then("the user is never asked", function (this: PermWorld) {
  assert.equal(this.asked.length, 0);
});
