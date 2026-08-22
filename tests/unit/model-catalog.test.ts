// tests/unit/model-catalog.test.ts — FR-SETUP-05 curated catalog invariants.

import { describe, expect, it } from "vitest";

import { modelChoicesFor, recommendedModelFor, defaultModelForProvider, fastModelForProvider, fastModelForPiProvider, modelForDepth } from "../../shared/model-catalog";

const LISTED_PROVIDERS = ["anthropic", "openai", "google"] as const;

describe("model catalog", () => {
  it("offers at least two choices for every listed provider", () => {
    for (const provider of LISTED_PROVIDERS) {
      expect(modelChoicesFor(provider)!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has exactly one recommended model per listed provider", () => {
    for (const provider of LISTED_PROVIDERS) {
      const recommended = modelChoicesFor(provider)!.filter((c) => c.recommended);
      expect(recommended).toHaveLength(1);
      expect(recommendedModelFor(provider)!.id).toBe(recommended[0].id);
    }
  });

  it("openai curated rows are the GPT-5.6 Codex family", () => {
    expect(modelChoicesFor("openai")!.map((c) => ({ id: c.id, tier: c.tier }))).toEqual([
      { id: "gpt-5.6-luna", tier: "fast" },
      { id: "gpt-5.6-terra", tier: "balanced" },
      { id: "gpt-5.6-sol", tier: "powerful" },
    ]);
  });

  it("has no catalog for custom (free-form input)", () => {
    expect(modelChoicesFor("custom")).toBeNull();
    expect(recommendedModelFor("custom")).toBeNull();
    expect(defaultModelForProvider("custom")).toBeUndefined();
    expect(fastModelForProvider("custom")).toBeUndefined();
  });

  it("exposes default and fast tier ids per provider", () => {
    expect(defaultModelForProvider("anthropic")).toBe("claude-sonnet-5");
    expect(fastModelForProvider("anthropic")).toBe("claude-haiku-4-5");
    expect(fastModelForProvider("openai")).toBe("gpt-5.6-luna");
    expect(defaultModelForProvider("openai")).toBe("gpt-5.6-terra");
    expect(fastModelForProvider("google")).toBe("gemini-3.5-flash");
  });

  it("maps Pi openai-codex to the Buddy openai catalog (not a second key)", () => {
    expect(modelChoicesFor("openai-codex")).toBeNull();
    expect(fastModelForProvider("openai-codex")).toBeUndefined();
    expect(fastModelForPiProvider("openai-codex")).toBe("gpt-5.6-luna");
    expect(fastModelForPiProvider("openai")).toBe("gpt-5.6-luna");
    expect(fastModelForPiProvider("anthropic")).toBe("claude-haiku-4-5");
    expect(fastModelForPiProvider("custom")).toBeUndefined();
  });

  it("resolves model id by consolidation depth (FR-CONSOL-15)", () => {
    expect(modelForDepth("anthropic", 1)).toBe("claude-haiku-4-5");
    expect(modelForDepth("anthropic", 2)).toBe("claude-haiku-4-5");
    expect(modelForDepth("anthropic", 3)).toBe("claude-sonnet-5");
    expect(modelForDepth("openai", 1)).toBe("gpt-5.6-luna");
    expect(modelForDepth("openai", 3)).toBe("gpt-5.6-terra");
    expect(modelForDepth("custom", 1)).toBeUndefined();
    expect(modelForDepth("custom", 3)).toBeUndefined();
  });
});
