// src/lib/provider-setup.ts — wizard provider helpers (browser-safe, FR-SETUP-05).

import type { SetupProviderId } from "../../shared/api";
import { DEFAULT_SETUP_PROVIDER, supportsOAuth } from "../../shared/provider-constants";

export { DEFAULT_SETUP_PROVIDER, supportsOAuth };

export function isApiKeyOnlyProvider(provider: SetupProviderId): boolean {
  return provider === "google" || provider === "custom";
}
