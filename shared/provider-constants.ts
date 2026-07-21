// shared/provider-constants.ts — Provider setup constants (wizard + settings).

import type { SetupProviderId } from "./api";

/** Default wizard provider (ChatGPT OAuth — primary target user). */
export const DEFAULT_SETUP_PROVIDER: SetupProviderId = "openai";

/** Whether the provider supports browser OAuth via Pi SDK. */
export function supportsOAuth(provider: SetupProviderId): boolean {
  return provider === "openai" || provider === "anthropic";
}
