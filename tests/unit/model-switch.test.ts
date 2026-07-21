// tests/unit/model-switch.test.ts — FR-SETTINGS-03 model resolution.

import { describe, expect, it } from "vitest";

import { resolveSessionModel } from "../../backends/model-switch";

describe("resolveSessionModel", () => {
  it("uses getModel when available", async () => {
    const model = await resolveSessionModel(
      {
        getModel: (provider, id) =>
          provider === "anthropic" && id === "claude-sonnet-5"
            ? { id, provider }
            : undefined,
        getAvailable: async () => [],
      },
      "anthropic",
      "claude-sonnet-5",
    );
    expect(model).toEqual({ id: "claude-sonnet-5", provider: "anthropic" });
  });

  it("falls back to getAvailable", async () => {
    const model = await resolveSessionModel(
      {
        getModel: () => undefined,
        getAvailable: async () => [{ id: "gpt-5", provider: "openai-codex" }],
      },
      "openai",
      "gpt-5",
    );
    expect(model.id).toBe("gpt-5");
  });

  it("throws when model is missing", async () => {
    await expect(
      resolveSessionModel(
        {
          getModel: () => undefined,
          getAvailable: async () => [],
        },
        "anthropic",
        "missing",
      ),
    ).rejects.toThrow(/Model not found/);
  });
});
