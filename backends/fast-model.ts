// backends/fast-model.ts — Fast-tier model resolution for lightweight sessions.

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { fastModelForPiProvider } from "../shared/model-catalog";
import { readPiProvider } from "../shared/pi-settings";

export type FastModelThinkingLevel = "off" | "minimal";

export type FastModelOptions = {
  model?: Awaited<ReturnType<ModelRuntime["getModel"]>>;
  thinkingLevel?: FastModelThinkingLevel;
};

/** Resolve fast-tier model for maintenance, reflect, and wiki synthesis. */
export async function resolveFastTierModel(
  rootDir: string,
  modelRuntime: ModelRuntime,
  thinkingLevel: FastModelThinkingLevel = "off",
): Promise<FastModelOptions> {
  const provider = readPiProvider(rootDir);
  const fastId = fastModelForPiProvider(provider);
  if (!fastId) return { thinkingLevel };
  let model = modelRuntime.getModel(provider, fastId);
  if (!model) {
    const available = await modelRuntime.getAvailable(provider);
    model = available.find((entry) => entry.id === fastId);
  }
  if (!model) return { thinkingLevel };
  return { model, thinkingLevel };
}

/** Depth 1-2 consolidation: fast tier with thinking off (FR-CONSOL-15). */
export async function resolveDepthModel(
  depth: number,
  rootDir: string,
  modelRuntime: ModelRuntime,
): Promise<FastModelOptions | Record<string, never>> {
  if (depth > 2) return {};
  return resolveFastTierModel(rootDir, modelRuntime, "off");
}
