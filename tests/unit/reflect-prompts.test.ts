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
    expect(prompt).toContain("OUTPUT-ONLY MODE");
  });
});
