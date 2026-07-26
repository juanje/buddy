// tests/steps/chat-input.steps.ts — FR-CHAT-02: User input with send.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { BuddyWorld } from "../support/world";
import { resolveInputKey } from "../../src/lib/keyboard";
import { autoResizeTextarea, sendAndResetTextarea } from "../../src/lib/input-bar";

async function pressKey(world: BuddyWorld, key: string, shiftKey = false): Promise<void> {
  const action = resolveInputKey({ key, shiftKey });
  if (action === "send") {
    await sendAndResetTextarea(() => world.controller.send(), world.mockTextarea);
  } else if (action === "newline") {
    world.controller.input.update((v) => v + "\n");
  }
  // "none" → the key does nothing at the chat level
}

Given("the input bar is focused", function (this: BuddyWorld) {
  this.connect();
  this.inputFocused = true;
});

Given("the input bar is empty", function (this: BuddyWorld) {
  this.connect();
  this.controller.input.set("");
});

When("I type {string}", function (this: BuddyWorld, text: string) {
  this.controller.input.update((v) => v + text);
});

When("I press Enter", async function (this: BuddyWorld) {
  await pressKey(this, "Enter", false);
});

When("I press Shift+Enter", async function (this: BuddyWorld) {
  await pressKey(this, "Enter", true);
});

Then("my message appears as a user bubble in the chat", function (this: BuddyWorld) {
  const messages = this.read(this.controller.messages);
  const last = messages[messages.length - 1];
  assert.ok(last, "expected at least one message");
  assert.equal(last.role, "user");
  assert.equal(last.text, "What can you help me with?");
});

Then("the input bar is cleared", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.input), "");
});

Then("the input bar is disabled while the assistant responds", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.inputDisabled), true);
});

Then("the input bar shows two lines of text", function (this: BuddyWorld) {
  const value = this.read(this.controller.input) as string;
  assert.equal(value.split("\n").length, 2, `expected two lines, got: ${JSON.stringify(value)}`);
});

Then("the sent message contains both lines", function (this: BuddyWorld) {
  const sent = this.session.promptCalls[this.session.promptCalls.length - 1];
  assert.ok(sent, "expected a prompt to have been sent");
  assert.ok(sent.includes("First line"), "missing first line");
  assert.ok(sent.includes("\n"), "missing newline");
  assert.ok(sent.includes("Second line"), "missing second line");
});

Then("the send button is disabled", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.canSend), false);
});

Then("no message is sent", function (this: BuddyWorld) {
  assert.equal(this.session.promptCalls.length, 0);
  assert.equal((this.read(this.controller.messages) as unknown[]).length, 0);
});

Given("the assistant is streaming a response", function (this: BuddyWorld) {
  this.connect();
  this.session.beginStreaming();
  this.session.emitAssistantMessageStart();
  this.session.emitTextDelta("Partial response text ");
});

Then("the input bar is disabled", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.inputDisabled), true);
});

Then("the send button is replaced by an abort button", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.showAbort), true);
});

When("the textarea has grown for multiline input", function (this: BuddyWorld) {
  autoResizeTextarea(this.mockTextarea);
  assert.notEqual(this.mockTextarea.style.height, "auto");
});

Then("the textarea height is reset to compact", function (this: BuddyWorld) {
  assert.equal(this.mockTextarea.style.height, "auto");
});
