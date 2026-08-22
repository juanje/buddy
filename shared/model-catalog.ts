// shared/model-catalog.ts — curated model choices per provider (FR-SETUP-05).
// A hand-picked v1 catalog (not a live provider query): the target user needs
// three understandable choices, not fifty ids. Keys are Buddy wizard ids
// (`openai`, not Pi's `openai-codex`). Ids must match Pi's catalog for that
// provider's runtime (OpenAI → openai-codex GPT-5.6 family). "custom" has no
// catalog — the user types the id their OpenAI-compatible server exposes.

import { fromPiProviderId } from "./provider-mapping";

export type ModelTier = "fast" | "balanced" | "powerful";

export interface ModelChoice {
  id: string;
  label: string;
  tier: ModelTier;
  recommended?: boolean;
}

const CATALOG: Record<string, ModelChoice[]> = {
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku", tier: "fast" },
    { id: "claude-sonnet-5", label: "Claude Sonnet", tier: "balanced", recommended: true },
    { id: "claude-opus-4-8", label: "Claude Opus", tier: "powerful" },
  ],
  openai: [
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", tier: "fast" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", tier: "balanced", recommended: true },
    { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", tier: "powerful" },
  ],
  google: [
    { id: "gemini-3.5-flash", label: "Gemini Flash", tier: "fast", recommended: true },
    { id: "gemini-3.5-pro", label: "Gemini Pro", tier: "powerful" },
  ],
};

/** Model choices for a provider, or null when only free-form input works. */
export function modelChoicesFor(provider: string): ModelChoice[] | null {
  return CATALOG[provider] ?? null;
}

/** The recommended entry (first marked, else first listed). */
export function recommendedModelFor(provider: string): ModelChoice | null {
  const choices = modelChoicesFor(provider);
  if (!choices || choices.length === 0) return null;
  return choices.find((c) => c.recommended) ?? choices[0];
}

/** Default model id for a provider (recommended tier). */
export function defaultModelForProvider(provider: string): string | undefined {
  return recommendedModelFor(provider)?.id;
}

/** Fast-tier model id for checkpoint reflect and other lightweight tasks. */
export function fastModelForProvider(provider: string): string | undefined {
  return modelChoicesFor(provider)?.find((c) => c.tier === "fast")?.id;
}

/** Fast-tier id when the caller has a Pi provider id (`openai-codex`, etc.). */
export function fastModelForPiProvider(piProviderId: string): string | undefined {
  return fastModelForProvider(fromPiProviderId(piProviderId) ?? piProviderId);
}

/** Model id for consolidation at a given depth (FR-CONSOL-15). */
export function modelForDepth(provider: string, depth: number): string | undefined {
  if (depth <= 2) return fastModelForProvider(provider);
  return defaultModelForProvider(provider);
}
