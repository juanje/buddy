// tests/steps/session-date-guard.steps.ts — FR-SESSION-06 mid-session date guard.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { assembleSystemPrompt } from "../../backends/prompt";
import {
  createDateGuardHandler,
  type DateGuardHandler,
} from "../../backends/date-guard";
import type { BuddyWorld } from "../support/world";

interface DateGuardWorld extends BuddyWorld {
  sessionStart?: Date;
  currentDate?: Date;
  originalPrompt?: string;
  handler?: DateGuardHandler;
  hookResult?: { systemPrompt: string } | undefined;
  finalPrompt?: string;
}

Given("a session was started on {string}", function (this: DateGuardWorld, isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  this.sessionStart = new Date(y, m - 1, d, 10, 0, 0);
  this.currentDate = this.sessionStart;
  this.originalPrompt = assembleSystemPrompt("/tmp/unused", this.sessionStart).prompt;
  this.handler = createDateGuardHandler(this.sessionStart, () => this.currentDate!);
});

When("the calendar date changes to {string}", function (this: DateGuardWorld, isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  this.currentDate = new Date(y, m - 1, d, 9, 0, 0);
});

When("the before_agent_start hook fires", async function (this: DateGuardWorld) {
  this.hookResult = await this.handler!({
    systemPrompt: this.originalPrompt!,
  });
  this.finalPrompt = this.hookResult?.systemPrompt ?? this.originalPrompt!;
});

When("the before_agent_start hook fires on the same day", async function (this: DateGuardWorld) {
  this.hookResult = await this.handler!({
    systemPrompt: this.originalPrompt!,
  });
  this.finalPrompt = this.hookResult?.systemPrompt ?? this.originalPrompt!;
});

Then("the system prompt includes {string}", function (this: DateGuardWorld, text: string) {
  assert.match(this.finalPrompt!, new RegExp(text));
});

Then(
  "the system prompt does not include {string} as the current date",
  function (this: DateGuardWorld, text: string) {
    const dateSection = this.finalPrompt!.match(/# Current date and time\n\n(.+)/)?.[1] ?? "";
    assert.doesNotMatch(dateSection, new RegExp(text));
  },
);

Then("the system prompt is unchanged", function (this: DateGuardWorld) {
  assert.equal(this.hookResult, undefined);
  assert.equal(this.finalPrompt, this.originalPrompt);
});
