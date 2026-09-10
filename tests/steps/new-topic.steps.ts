// tests/steps/new-topic.steps.ts — FR-TOPIC-01/02/04/05 topic transition.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { get } from "svelte/store";

import type { BuddyWorld } from "../support/world";
import { NEW_TOPIC_BUTTON_CLASS } from "../../src/lib/new-topic-contract";
import { getLocale, setLocale, t } from "../../src/lib/i18n";

Given("the chat view is active", function (this: BuddyWorld) {
  this.connect();
});

Given("an active session with messages", async function (this: BuddyWorld) {
  this.connect();
  this.controller.input.set("Previous topic message");
  await this.controller.send();
  this.session.endStreaming();
  assert.ok(this.read(this.controller.messages).length > 0);
});

When('the user triggers "Start now" via new topic', async function (this: BuddyWorld) {
  await this.controller.newTopic();
});

Then('the input bar contains a {string} ghost button', function (this: BuddyWorld, label: string) {
  assert.equal(NEW_TOPIC_BUTTON_CLASS, "new-topic-button");
  assert.equal(get(t).newTopicButton, label);
});

Then("the current session shutdown fires", function (this: BuddyWorld) {
  assert.equal(this.topicShutdownCalled, true);
});

Then("the chat messages are cleared", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.messages).length, 0);
});

Then("a new session starts", function (this: BuddyWorld) {
  assert.equal(this.topicSessionRestarted, true);
});

Then("no previous session context is injected", function (this: BuddyWorld) {
  const messages = this.read(this.controller.messages);
  assert.equal(messages.length, 0);
  assert.ok(
    !messages.some((m) => m.text.includes("Previous topic message")),
    "previous session transcript should not carry over",
  );
});

Then("the new topic button is disabled", function (this: BuddyWorld) {
  assert.equal(this.read(this.controller.newTopicDisabled), true);
});

Given("a topic transition is in progress", function (this: BuddyWorld) {
  this.connect();
  this.controller.beginTopicTransition();
});

Given('the app language is {string}', function (this: BuddyWorld, locale: string) {
  setLocale(locale as "en" | "es");
  assert.equal(getLocale(), locale);
});

Then('the new topic button reads {string}', function (this: BuddyWorld, label: string) {
  assert.equal(get(t).newTopicButton, label);
});
