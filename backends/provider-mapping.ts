// backends/provider-mapping.ts — ab-app provider ids ↔ Pi SDK provider ids (FR-SETUP-05).

import type { SetupProviderId } from "../shared/api";

/** Pi SDK provider id for each ab-app wizard provider. */
export function toPiProviderId(provider: SetupProviderId): string {
  switch (provider) {
    case "openai":
      return "openai-codex";
    case "anthropic":
      return "anthropic";
    case "google":
      return "google";
    case "custom":
      return "custom";
  }
}

/** Map Pi auth.json key back to ab-app provider id. */
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

/** Whether the provider supports browser OAuth via Pi SDK. */
export function supportsOAuth(provider: SetupProviderId): boolean {
  return provider === "openai" || provider === "anthropic";
}

/** Default wizard provider (ChatGPT OAuth — primary target user). */
export const DEFAULT_SETUP_PROVIDER: SetupProviderId = "openai";

/** Pi provider ids checked for auth status in the wizard. */
export const WIZARD_PI_PROVIDERS = ["openai-codex", "anthropic", "google"] as const;
