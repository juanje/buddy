// tests/steps/chat-input.steps.ts — FR-CHAT-02: User input with send.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { AbWorld } from "../support/world";
import { resolveInputKey } from "../../src/lib/keyboard";

async function pressKey(world: AbWorld, key: string, shiftKey = false): Promise<void> {
  const action = resolveInputKey({ key, shiftKey });
  if (action === "send") {
    await world.controller.send();
  } else if (action === "newline") {
    world.controller.input.update((v) => v + "\n");
  }
  // "none" → the key does nothing at the chat level
}

Given("the input bar is focused", function (this: AbWorld) {
  this.connect();
  this.inputFocused = true;
});

Given("the input bar is empty", function (this: AbWorld) {
  this.connect();
  this.controller.input.set("");
});

When("I type {string}", function (this: AbWorld, text: string) {
  this.controller.input.update((v) => v + text);
});

When("I press Enter", async function (this: AbWorld) {
  await pressKey(this, "Enter", false);
});

When("I press Shift+Enter", async function (this: AbWorld) {
  await pressKey(this, "Enter", true);
});

Then("my message appears as a user bubble in the chat", function (this: AbWorld) {
  const messages = this.read(this.controller.messages);
  const last = messages[messages.length - 1];
  assert.ok(last, "expected at least one message");
  assert.equal(last.role, "user");
  assert.equal(last.text, "What can you help me with?");
});

Then("the input bar is cleared", function (this: AbWorld) {
  assert.equal(this.read(this.controller.input), "");
});

Then("the input bar is disabled while the assistant responds", function (this: AbWorld) {
  assert.equal(this.read(this.controller.inputDisabled), true);
});

Then("the input bar shows two lines of text", function (this: AbWorld) {
  const value = this.read(this.controller.input) as string;
  assert.equal(value.split("\n").length, 2, `expected two lines, got: ${JSON.stringify(value)}`);
});

Then("the sent message contains both lines", function (this: AbWorld) {
  const sent = this.session.promptCalls[this.session.promptCalls.length - 1];
  assert.ok(sent, "expected a prompt to have been sent");
  assert.ok(sent.includes("First line"), "missing first line");
  assert.ok(sent.includes("\n"), "missing newline");
  assert.ok(sent.includes("Second line"), "missing second line");
});

Then("the send button is disabled", function (this: AbWorld) {
  assert.equal(this.read(this.controller.canSend), false);
});

Then("no message is sent", function (this: AbWorld) {
  assert.equal(this.session.promptCalls.length, 0);
  assert.equal((this.read(this.controller.messages) as unknown[]).length, 0);
});

Given("the assistant is streaming a response", function (this: AbWorld) {
  this.connect();
  this.session.beginStreaming();
  this.session.emitAssistantMessageStart();
  this.session.emitTextDelta("Partial response text ");
});

Then("the input bar is disabled", function (this: AbWorld) {
  assert.equal(this.read(this.controller.inputDisabled), true);
});

Then("the send button is replaced by an abort button", function (this: AbWorld) {
  assert.equal(this.read(this.controller.showAbort), true);
});
