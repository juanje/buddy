// tests/steps/chat-abort.steps.ts — FR-CHAT-03: Abort generation.

import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { BuddyWorld } from "../support/world";
import type { ChatMessage } from "../../src/lib/chat-controller";

When("I click the abort button", async function (this: BuddyWorld) {
  await this.controller.abort();
});

When("I press Escape", async function (this: BuddyWorld) {
  await this.controller.onEscape();
});

Then("the streaming stops within 2 seconds", function (this: BuddyWorld) {
  // FakeSession aborts synchronously; the 2s budget is an upper bound (NFR).
  assert.equal(this.read(this.controller.streaming), false);
  assert.equal(this.session.abortCalls > 0, true, "expected session.abort() to be called");
});

Then("the partial response remains visible in the chat", function (this: BuddyWorld) {
  const messages = this.read(this.controller.messages) as ChatMessage[];
  const assistant = messages.filter((m) => m.role === "assistant");
  assert.equal(assistant.length, 1, "expected the partial assistant bubble to remain");
  assert.ok(
    assistant[0].text.startsWith("Partial response text"),
    `partial text lost: ${JSON.stringify(assistant[0].text)}`,
  );
});

Then("the send button replaces the abort button", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.showAbort), false);
});

Then("nothing happens", function (this: BuddyWorld) {
  assert.equal(this.session.abortCalls, 0, "abort must not be called while idle");
  assert.equal(this.read(this.controller.streaming), false);
  assert.equal((this.read(this.controller.messages) as ChatMessage[]).length, 0);
});

Then("the input bar remains focused", function (this: BuddyWorld) {
  assert.equal(this.inputFocused, true);
});
