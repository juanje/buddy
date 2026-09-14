// tests/unit/reflect-prompts.test.ts — FR-SKILL-04: reflect child uses bundled process-conversation prompt.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { registerEmbeddedAssets } from "../../backends/embedded-assets";
import { bundledPromptsDir } from "../../backends/deploy-bundled-content";
import {
  buildReflectUserPrompt,
  CHECKPOINT_USER_PROMPT,
  loadProcessConversationPrompt,
  OUTPUT_ONLY_SUFFIX,
} from "../../backends/reflect-prompts";

describe("loadProcessConversationPrompt", () => {
  afterEach(() => {
    registerEmbeddedAssets(undefined);
  });

  it("reads from disk in dev when no embedded snapshot is registered", () => {
    const fromDisk = readFileSync(
      join(bundledPromptsDir(), "process-conversation.md"),
      "utf8",
    );
    expect(loadProcessConversationPrompt()).toBe(fromDisk);
    expect(loadProcessConversationPrompt()).toContain("# Skill: Process conversation");
    expect(loadProcessConversationPrompt()).not.toContain("## When to use");
  });

  it("prefers embedded snapshot when registered", () => {
    registerEmbeddedAssets({
      templates: {},
      prompts: {
        "process-conversation.md": "# Embedded process conversation",
      },
      docs: {},
    });
    expect(loadProcessConversationPrompt()).toBe("# Embedded process conversation");
  });
});

describe("process-conversation prompt content", () => {
  it("instructs English for log entries regardless of conversation language", () => {
    const prompt = loadProcessConversationPrompt();
    expect(prompt.toLowerCase()).toContain("in english");
  });

  it("includes a rule-candidate example to help smaller models", () => {
    const prompt = loadProcessConversationPrompt();
    expect(prompt).toContain("Rule candidate:");
    expect(prompt).toMatch(/example|e\.g\./i);
  });

  it("includes observation exclusion criteria (FR-REFLECT-10)", () => {
    const prompt = loadProcessConversationPrompt();
    expect(prompt).toContain("NOT a candidate");
  });

  it("instructs preserving concrete facts (FR-REFLECT-10)", () => {
    const prompt = loadProcessConversationPrompt();
    expect(prompt).toContain("Concrete facts feed");
    expect(prompt).toContain("Preserve concrete facts");
  });

  it("distinguishes explicit correction from inferred rule candidates (FR-REFLECT-10)", () => {
    const prompt = loadProcessConversationPrompt();
    expect(prompt).toMatch(/explicit user correction/i);
    expect(prompt).toMatch(/inferred/i);
  });

  it("instructs emitting Right now patches for volatile state (FR-REFLECT-11)", () => {
    const prompt = loadProcessConversationPrompt();
    expect(prompt).toContain("Right now patches");
    expect(prompt).toContain("volatile state");
  });
});

describe("buildReflectUserPrompt", () => {
  afterEach(() => {
    registerEmbeddedAssets(undefined);
  });

  it("returns checkpoint prompt unchanged", () => {
    expect(buildReflectUserPrompt("checkpoint")).toBe(CHECKPOINT_USER_PROMPT);
  });

  it("appends output-only suffix for session-end reflect", () => {
    const prompt = buildReflectUserPrompt("session-end");
    expect(prompt).toContain("# Skill: Process conversation");
    expect(prompt.endsWith(OUTPUT_ONLY_SUFFIX.trim())).toBe(true);
    expect(prompt).toContain("You have no tools in this context");
  });

  it("suffix requires decision reasoning and values observations (FR-REFLECT-10)", () => {
    expect(OUTPUT_ONLY_SUFFIX).toMatch(/full reasoning behind decisions/i);
    expect(OUTPUT_ONLY_SUFFIX).toMatch(/most valuable part of the reflect/i);
    expect(OUTPUT_ONLY_SUFFIX).not.toMatch(/Produce ONLY/i);
  });

  it("suffix instructs Right now patches (FR-REFLECT-11)", () => {
    expect(OUTPUT_ONLY_SUFFIX).toContain("Right now patches");
  });
});
