// shared/provider-mapping.ts — Buddy provider ids ↔ Pi SDK provider ids (FR-SETUP-05).

import type { SetupProviderId } from "./api";

export type AuthType = "api_key" | "oauth";

/**
 * Pi SDK provider id for each Buddy wizard provider.
 *
 * OpenAI has two Pi providers: `openai-codex` (OAuth via ChatGPT Plus/Pro) and
 * `openai` (direct API key via api.openai.com). Pass `authType` to pick the
 * right one; omitting it defaults to `openai-codex` for backward compat.
 */
export function toPiProviderId(provider: SetupProviderId, authType?: AuthType): string {
  switch (provider) {
    case "openai":
      return authType === "api_key" ? "openai" : "openai-codex";
    case "anthropic":
      return "anthropic";
    case "google":
      return "google";
    case "custom":
      return "custom";
  }
}

/** Map Pi auth.json key back to Buddy provider id. */
export function fromPiProviderId(piProviderId: string): SetupProviderId | undefined {
  switch (piProviderId) {
    case "openai-codex":
    case "openai":
      return "openai";
    case "anthropic":
      return "anthropic";
    case "google":
      return "google";
    default:
      return undefined;
  }
}

/** Pi provider ids checked for auth status in the wizard. */
export const WIZARD_PI_PROVIDERS = ["openai-codex", "openai", "anthropic", "google"] as const;
