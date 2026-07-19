// tests/unit/model-listing.test.ts — live SDK list + curated fallback (FR-SETUP-05).

import { describe, expect, it } from "vitest";

import { listModelsForProvider } from "../../backends/model-listing";
import { modelChoicesFor, recommendedModelFor } from "../../src/lib/model-catalog";

describe("listModelsForProvider", () => {
  it("returns live models when the SDK has entries", async () => {
    const runtime = {
      getAvailable: async () => [
        { id: "gpt-live-1", name: "GPT Live" },
        { id: "gpt-live-2", name: "GPT Live 2" },
      ],
    };

    const models = await listModelsForProvider(runtime, "openai");
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ id: "gpt-live-1", label: "GPT Live", provider: "openai" });
    const recommended = recommendedModelFor("openai")?.id;
    if (recommended) {
      const flagged = models.find((m) => m.id === recommended);
      if (flagged) expect(flagged.recommended).toBe(true);
    }
  });

  it("falls back to the curated catalog when live list is empty", async () => {
    const runtime = { getAvailable: async () => [] };
    const models = await listModelsForProvider(runtime, "anthropic");
    const catalog = modelChoicesFor("anthropic")!;
    expect(models.map((m) => m.id)).toEqual(catalog.map((c) => c.id));
  });

  it("falls back to the curated catalog when getAvailable throws", async () => {
    const runtime = {
      getAvailable: async () => {
        throw new Error("offline");
      },
    };
    const models = await listModelsForProvider(runtime, "google");
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].provider).toBe("google");
  });
});
