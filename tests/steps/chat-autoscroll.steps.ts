// tests/steps/chat-autoscroll.steps.ts — FR-CHAT-07: Auto-scroll with manual override.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { AbWorld } from "../support/world";

function atBottom(world: AbWorld): boolean {
  const v = world.viewport;
  return v.scrollTop >= v.scrollHeight - v.clientHeight;
}

Given("there are several messages in the chat history", async function (this: AbWorld) {
  this.connect();
  for (let i = 1; i <= 3; i++) {
    this.controller.input.set(`Message ${i}`);
    await this.controller.send();
    this.session.streamResponse([`Reply ${i} — some content to fill the viewport.`]);
  }
});

Given("the chat is scrolled to the bottom", function (this: AbWorld) {
  this.viewport.scrollTop = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
  this.scroll.onUserScrolled(true);
});

When(
  "the assistant generates a response longer than the viewport",
  async function (this: AbWorld) {
    this.controller.input.set("Tell me a long story");
    await this.controller.send();
    this.session.emitAssistantMessageStart();
    for (let i = 0; i < 60; i++) {
      this.session.emitTextDelta("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ");
    }
    this.session.emitAssistantMessageEnd();
    this.session.endStreaming();
  },
);

Then("the chat scrolls to keep the latest text visible", function (this: AbWorld) {
  assert.ok(
    this.viewport.scrollHeight > this.viewport.clientHeight,
    "content should be longer than the viewport",
  );
  assert.ok(atBottom(this), "expected viewport to be scrolled to the bottom");
});

When("I scroll up to review earlier messages", function (this: AbWorld) {
  this.viewport.scrollTop = Math.max(0, this.viewport.scrollTop - 200);
  this.scroll.onUserScrolled(false);
});

Then("auto-scroll stops", function (this: AbWorld) {
  assert.equal(this.read(this.scroll.autoScroll), false);
  // New content must NOT pull the view down anymore:
  const before = this.viewport.scrollTop;
  this.session.emitTextDelta("more streamed text ");
  assert.equal(this.viewport.scrollTop, before, "viewport moved despite manual scroll");
});

Then("a {string} button appears", function (this: AbWorld, _label: string) {
  assert.equal(this.read(this.scroll.showScrollButton), true);
});

Given("I have scrolled up during a streaming response", function (this: AbWorld) {
  this.connect();
  this.session.beginStreaming();
  this.session.emitAssistantMessageStart();
  for (let i = 0; i < 30; i++) this.session.emitTextDelta("streaming text chunk ");
  this.viewport.scrollTop = Math.max(0, this.viewport.scrollTop - 150);
  this.scroll.onUserScrolled(false);
});

Given("the {string} button is visible", function (this: AbWorld, _label: string) {
  assert.equal(this.read(this.scroll.showScrollButton), true);
});

When("I click the {string} button", function (this: AbWorld, _label: string) {
  this.scroll.scrollToBottomClicked();
});

Then("the chat scrolls to the latest content", function (this: AbWorld) {
  assert.ok(atBottom(this), "expected viewport at the bottom");
});

Then("auto-scroll resumes for the current response", function (this: AbWorld) {
  assert.equal(this.read(this.scroll.autoScroll), true);
  this.session.emitTextDelta("even more text ");
  assert.ok(atBottom(this), "expected auto-scroll to follow new content again");
});

Given("I have scrolled up in the chat history", function (this: AbWorld) {
  this.viewport.scrollTop = 0;
  this.scroll.onUserScrolled(false);
});

When("I send a new message", async function (this: AbWorld) {
  this.controller.input.set("Another question");
  await this.controller.send();
  // View wiring: InputBar notifies the scroll controller after sending.
  this.scroll.onUserMessageSent();
});

Then("the chat scrolls to the bottom to show my message", function (this: AbWorld) {
  assert.ok(atBottom(this), "expected viewport at the bottom after sending");
});

Then("auto-scroll is re-enabled", function (this: AbWorld) {
  assert.equal(this.read(this.scroll.autoScroll), true);
});
