// tests/steps/reflect-interrupt.steps.ts — NFR-REL-11.

import { Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import {
  reflectInterruptSignals,
  reflectInterruptedMessage,
} from "../../backends/reflect-interrupt";

Then(
  "reflect interrupt signals on {string} include {string}, {string} and {string}",
  function (platform: string, a: string, b: string, c: string) {
    const signals = reflectInterruptSignals(platform as NodeJS.Platform);
    for (const s of [a, b, c]) assert.ok(signals.includes(s as NodeJS.Signals), s);
  },
);

Then(
  "reflect interrupt signals on {string} include {string} and {string}",
  function (platform: string, a: string, b: string) {
    const signals = reflectInterruptSignals(platform as NodeJS.Platform);
    for (const s of [a, b]) assert.ok(signals.includes(s as NodeJS.Signals), s);
    assert.equal(signals.includes("SIGBREAK" as NodeJS.Signals), false);
  },
);

Then(
  "the reflect interrupted message for {string} has no single quotes",
  function (signal: string) {
    const msg = reflectInterruptedMessage(signal);
    assert.doesNotMatch(msg, /'/);
    assert.match(msg, /reflect interrupted/);
    assert.match(msg, new RegExp(`\\(${signal}\\)`));
  },
);
