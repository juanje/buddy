// tests/steps/reflect-quality.steps.ts — FR-REFLECT-10 / FR-PROMPT-09.

import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { OUTPUT_ONLY_SUFFIX } from "../../backends/reflect-prompts";

interface ReflectQualityWorld {
  outputOnlySuffix?: string;
}

Given("the output-only suffix for session-end reflect", function (this: ReflectQualityWorld) {
  this.outputOnlySuffix = OUTPUT_ONLY_SUFFIX;
});

Then(
  "the suffix instructs capturing full reasoning behind decisions",
  function (this: ReflectQualityWorld) {
    const suffix = this.outputOnlySuffix ?? "";
    assert.match(
      suffix,
      /full reasoning behind decisions/i,
      `suffix missing reasoning instruction: ${suffix.slice(0, 200)}`,
    );
  },
);

Then(
  "the suffix frames observations as the most valuable reflect output",
  function (this: ReflectQualityWorld) {
    const suffix = this.outputOnlySuffix ?? "";
    assert.match(
      suffix,
      /most valuable part of the reflect/i,
      `suffix missing observation value framing: ${suffix.slice(0, 200)}`,
    );
  },
);

Then("the suffix does not frame output as Produce ONLY", function (this: ReflectQualityWorld) {
  const suffix = this.outputOnlySuffix ?? "";
  assert.doesNotMatch(
    suffix,
    /Produce ONLY/i,
    "suffix still uses minimalist Produce ONLY framing",
  );
});
