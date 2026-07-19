// tests/steps/common.steps.ts — Background steps shared across chat features.

import { Given } from "@cucumber/cucumber";
import type { AbWorld } from "../support/world";

Given("the app is running", function (this: AbWorld) {
  // App shell boots; nothing to assert until the session connects.
});

Given("the Pi SDK session is connected", function (this: AbWorld) {
  this.connect();
});
