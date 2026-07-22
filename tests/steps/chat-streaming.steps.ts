// tests/steps/chat-streaming.steps.ts — FR-CHAT-01: Streaming message display.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { AbWorld } from "../support/world";
import type { ChatMessage } from "../../src/lib/chat-controller";
import { assistantBubbles } from "../support/chat-helpers";

Given("the chat is idle", function (this: AbWorld) {
  this.connect();
  assert.equal(this.read(this.controller.streaming), false);
});

When("I send the message {string}", async function (this: AbWorld, text: string) {
  this.controller.input.set(text);
  await this.controller.send();
});

Then("a typing indicator appears", function (this: AbWorld) {
  assert.equal(this.read(this.controller.typingIndicator), true);
});

Then(
  "text begins appearing token-by-token in an assistant bubble",
  function (this: AbWorld) {
    this.session.emitAssistantMessageStart();

    this.session.emitTextDelta("Hello");
    let bubbles = assistantBubbles(this);
    assert.equal(bubbles.length, 1, "expected one assistant bubble after first delta");
    assert.equal(bubbles[0].text, "Hello");

    this.session.emitTextDelta(" there!");
    bubbles = assistantBubbles(this);
    assert.equal(bubbles[0].text, "Hello there!", "expected text to grow with each delta");
  },
);

Then("the typing indicator disappears when the response completes", function (this: AbWorld) {
  this.session.emitAssistantMessageEnd();
  this.session.endStreaming();
  assert.equal(this.read(this.controller.typingIndicator), false);
});

Then("the input bar is re-enabled", function (this: AbWorld) {
  assert.equal(this.read(this.controller.inputDisabled), false);
});

Given("the assistant has finished a response", async function (this: AbWorld) {
  this.connect();
  this.controller.input.set("First question");
  await this.controller.send(); // fake begins streaming on prompt
  this.session.emitAssistantMessageStart();
  this.session.emitTextDelta("Earlier response");
  this.session.emitAssistantMessageEnd();
  this.session.endStreaming();
});

When("I send another message {string}", async function (this: AbWorld, text: string) {
  this.controller.input.set(text);
  await this.controller.send();
});

Then("a new assistant bubble appears below the previous one", function (this: AbWorld) {
  this.session.emitAssistantMessageStart();
  this.session.emitTextDelta("More info");
  const bubbles = assistantBubbles(this);
  assert.equal(bubbles.length, 2, "expected a second assistant bubble");
  const all = this.read(this.controller.messages) as ChatMessage[];
  assert.equal(all[all.length - 1].role, "assistant");
  assert.equal(all[all.length - 1].text, "More info");
});

Then("text streams into the new bubble", function (this: AbWorld) {
  this.session.emitTextDelta(" arriving now");
  const bubbles = assistantBubbles(this);
  assert.equal(bubbles[bubbles.length - 1].text, "More info arriving now");
});

Then("the previous bubble remains unchanged", function (this: AbWorld) {
  const bubbles = assistantBubbles(this);
  assert.equal(bubbles[0].text, "Earlier response");
});

When("the assistant produces an empty response", function (this: AbWorld) {
  this.session.beginStreaming();
  this.session.emitAssistantMessageStart();
  this.session.emitAssistantMessageEnd(); // no text deltas at all
  this.session.endStreaming();
});

Then("no empty bubble is shown", function (this: AbWorld) {
  assert.equal(assistantBubbles(this).length, 0);
});
