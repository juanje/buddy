// tests/steps/common.steps.ts — Background steps shared across chat features.

import { Given } from "@cucumber/cucumber";
import type { BuddyWorld } from "../support/world";

Given("the app is running", function (this: BuddyWorld) {
  // App shell boots; nothing to assert until the session connects.
});

Given("the Pi SDK session is connected", function (this: BuddyWorld) {
  this.connect();
});
