// tests/unit/fast-model.test.ts — fast-tier lookup uses Buddy catalog via Pi ids.

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { resolveFastTierModel } from "../../backends/fast-model";
import { writePiSettings } from "../../shared/pi-settings";

function runtimeWith(
  models: Array<{ id: string; provider: string }>,
): ModelRuntime {
  return {
    getModel: (provider: string, id: string) =>
      models.find((m) => m.provider === provider && m.id === id),
    getAvailable: async (provider?: string) =>
      models.filter((m) => !provider || m.provider === provider),
  } as ModelRuntime;
}

describe("resolveFastTierModel", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function instance(provider: "openai" | "anthropic", model: string): string {
    const root = mkdtempSync(join(tmpdir(), "fast-model-"));
    dirs.push(root);
    writePiSettings(root, { provider, model });
    return root;
  }

  it("resolves openai-codex settings to GPT-5.6 Luna", async () => {
    const root = instance("openai", "gpt-5.6-terra");
    const result = await resolveFastTierModel(
      root,
      runtimeWith([
        { id: "gpt-5.6-luna", provider: "openai-codex" },
        { id: "gpt-5.6-terra", provider: "openai-codex" },
        { id: "gpt-5.3-codex-spark", provider: "openai-codex" },
      ]),
    );
    expect(result.model?.id).toBe("gpt-5.6-luna");
    expect(result.thinkingLevel).toBe("off");
  });

  it("still resolves anthropic to Haiku (Pi id equals Buddy id)", async () => {
    const root = instance("anthropic", "claude-sonnet-5");
    const result = await resolveFastTierModel(
      root,
      runtimeWith([
        { id: "claude-haiku-4-5", provider: "anthropic" },
        { id: "claude-sonnet-5", provider: "anthropic" },
      ]),
      "minimal",
    );
    expect(result.model?.id).toBe("claude-haiku-4-5");
    expect(result.thinkingLevel).toBe("minimal");
  });

  it("keeps thinkingLevel and skips model when the fast id is not in the runtime", async () => {
    const root = instance("openai", "gpt-5.6-luna");
    const result = await resolveFastTierModel(
      root,
      runtimeWith([{ id: "gpt-5.3-codex-spark", provider: "openai-codex" }]),
    );
    expect(result.model).toBeUndefined();
    expect(result.thinkingLevel).toBe("off");
  });
});
