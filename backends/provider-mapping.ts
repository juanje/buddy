// backends/provider-mapping.ts — Buddy provider ids ↔ Pi SDK provider ids (FR-SETUP-05).

import type { SetupProviderId } from "../shared/api";
import { DEFAULT_SETUP_PROVIDER, supportsOAuth } from "../shared/provider-constants";

export { DEFAULT_SETUP_PROVIDER, supportsOAuth };

/** Pi SDK provider id for each Buddy wizard provider. */
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
export const WIZARD_PI_PROVIDERS = ["openai-codex", "anthropic", "google"] as const;
