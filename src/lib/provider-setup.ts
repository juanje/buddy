// src/lib/provider-setup.ts — wizard provider helpers (browser-safe, FR-SETUP-05).

import type { SetupProviderId } from "../../shared/api";

export const DEFAULT_SETUP_PROVIDER: SetupProviderId = "openai";

export function supportsOAuth(provider: SetupProviderId): boolean {
  return provider === "openai" || provider === "anthropic";
}

export function isApiKeyOnlyProvider(provider: SetupProviderId): boolean {
  return provider === "google" || provider === "custom";
}
