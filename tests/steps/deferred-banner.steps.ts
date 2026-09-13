// tests/steps/deferred-banner.steps.ts — FR-DEFERRED-04 Close vs Dismiss.

import { Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { BuddyWorld } from "../support/world";

When("I close the deferred banner", function (this: BuddyWorld) {
  this.deferredDismissRpcCount = 0;
  this.controller.closeWelcome();
});

When("I dismiss the deferred banner", function (this: BuddyWorld) {
  this.deferredDismissRpcCount = 0;
  this.controller.dismissWelcome();
});

Then("the deferred dismiss RPC was not called", function (this: BuddyWorld) {
  assert.equal(this.deferredDismissRpcCount, 0);
});

Then("the deferred dismiss RPC was called", function (this: BuddyWorld) {
  assert.ok(this.deferredDismissRpcCount > 0, "dismissWelcome should acknowledge deferred items");
});
