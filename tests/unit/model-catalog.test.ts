// tests/unit/model-catalog.test.ts — FR-SETUP-05 curated catalog invariants.

import { describe, expect, it } from "vitest";

import { modelChoicesFor, recommendedModelFor } from "../../src/lib/model-catalog";

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

  it("has no catalog for custom (free-form input)", () => {
    expect(modelChoicesFor("custom")).toBeNull();
    expect(recommendedModelFor("custom")).toBeNull();
  });
});
