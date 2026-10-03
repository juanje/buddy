// backends/model-listing.ts — live model list + curated fallback (FR-SETUP-05).

import type { ModelInfo, SetupProviderId } from "../shared/api";
import { PROVIDER_REQUEST_TIMEOUT_MS } from "../shared/defaults";
import {
  modelChoicesFor,
  recommendedModelFor,
  type ModelChoice,
} from "../shared/model-catalog";
import { type AuthType, toPiProviderId } from "../shared/provider-mapping";
import { withTimeout } from "./with-timeout";

export interface ModelRuntimeLike {
  getAvailable(providerId?: string): Promise<readonly { id: string; name?: string }[]>;
}

function fromCatalog(provider: SetupProviderId): ModelInfo[] {
  const choices = modelChoicesFor(provider);
  if (!choices) return [];
  return choices.map((c: ModelChoice) => ({
    id: c.id,
    label: c.label,
    provider,
    tier: c.tier,
    recommended: c.recommended,
  }));
}

/**
 * List models: live SDK first, curated catalog if empty, unavailable or slow.
 *
 * NFR-REL-09: bounded. This is called from the wizard's model step, which shows
 * a spinner and no way out; a provider that accepts the connection and stalls
 * used to leave the user stuck on that screen with the curated list — which was
 * sitting right there — never shown.
 */
export async function listModelsForProvider(
  runtime: ModelRuntimeLike,
  provider: SetupProviderId,
  timeoutMs: number = PROVIDER_REQUEST_TIMEOUT_MS,
  authType?: AuthType,
): Promise<ModelInfo[]> {
  const piProvider = toPiProviderId(provider, authType);
  try {
    // `getAvailable` goes over the network but takes no signal, so the timeout
    // has to wrap it. The request is abandoned, not cancelled — acceptable here
    // precisely because the fallback is a static catalog: nothing is lost by
    // giving up on it.
    const available = await withTimeout(runtime.getAvailable(piProvider), timeoutMs);
    if (available.length > 0) {
      const recommended = recommendedModelFor(provider)?.id;
      return available.map((m) => ({
        id: m.id,
        label: m.name ?? m.id,
        provider,
        recommended: m.id === recommended,
      }));
    }
  } catch {
    // Offline, auth not ready, or too slow — fall through to catalog.
  }
  return fromCatalog(provider);
}
