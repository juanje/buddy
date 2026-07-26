// tests/steps/chat-display.steps.ts — FR-CHAT-06 + FR-DEFERRED-01 visual.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { AbWorld } from "../support/world";
import { toolActivityBlocks } from "../support/chat-helpers";

When("the assistant reads files {string} and {string}", function (this: AbWorld, a: string, b: string) {
  this.session.emitToolExecutionStart("read", a);
  this.session.emitToolExecutionEnd("read", a);
  this.session.emitToolExecutionStart("read", b);
  this.session.emitToolExecutionEnd("read", b);
});

Then("a tool activity block shows {int} read operations", function (this: AbWorld, count: number) {
  const blocks = toolActivityBlocks(this);
  assert.equal(blocks.length, 1, "expected one tool activity block");
  const reads = blocks[0].toolCalls?.filter((c) => c.name === "read") ?? [];
  assert.equal(reads.length, count);
  assert.ok(reads.every((c) => c.status === "done"));
});

Then("the tool activity block is collapsed by default", function (this: AbWorld) {
  const block = toolActivityBlocks(this)[0];
  assert.ok(block);
  assert.equal(block.text, "");
});

Given("the welcome banner is visible", function (this: AbWorld) {
  this.connect();
  assert.equal(this.read(this.controller.welcomeVisible), true);
});

Then("the welcome banner is hidden", function (this: AbWorld) {
  assert.equal(this.read(this.controller.welcomeVisible), false);
});
