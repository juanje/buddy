// tests/steps/sdk-compat.steps.ts — FR-SDK-01 BDD steps.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { AgentEvent } from "../../shared/api";
import type { BuddyWorld } from "../support/world";
import { assistantBubbles } from "../support/chat-helpers";
import { FakeSession } from "../support/fake-session";

Given("a started session", function (this: BuddyWorld) {
  this.connect();
});

When(
  "the assistant streams {string} as deltas",
  function (this: BuddyWorld, text: string) {
    this.session.emitAssistantMessageStart();
    const mid = Math.ceil(text.length / 2);
    this.session.emitTextDelta(text.slice(0, mid));
    this.session.emitTextDelta(text.slice(mid));
    this.session.emitAssistantMessageEnd();
    this.session.endStreaming();
  },
);

Then("the chat displays {string}", function (this: BuddyWorld, text: string) {
  const bubbles = assistantBubbles(this);
  assert.equal(bubbles.length, 1, "expected one assistant bubble");
  assert.equal(bubbles[0].text, text);
});

Then(
  "no message_update event carries a cumulative message field",
  function (this: BuddyWorld) {
    const events: AgentEvent[] = [];
    const probe = new FakeSession();
    probe.subscribe((event: AgentEvent) => events.push(event));
    probe.beginStreaming();
    probe.emitTextDelta("probe");
    const update = events.find((event) => event.type === "message_update");
    assert.ok(update, "expected a message_update event");
    assert.equal("message" in update!, false);
    const assistantEvent = update!.assistantMessageEvent as Record<string, unknown> | undefined;
    assert.ok(assistantEvent);
    assert.equal("partial" in assistantEvent!, false);
  },
);
