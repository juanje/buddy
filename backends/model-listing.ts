// backends/model-listing.ts — live model list + curated fallback (FR-SETUP-05).

import type { ModelInfo, SetupProviderId } from "../shared/api";
import { PROVIDER_REQUEST_TIMEOUT_MS } from "../shared/defaults";
import {
  modelChoicesFor,
  recommendedModelFor,
  type ModelChoice,
} from "../shared/model-catalog";
import { toPiProviderId } from "../shared/provider-mapping";

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
 * Reject after `timeoutMs` rather than waiting on `promise` forever.
 *
 * `getAvailable` goes over the network but takes no signal, so the timeout has
 * to wrap it. The underlying request is not cancelled — it is abandoned, and
 * its result ignored — which is acceptable here precisely because the fallback
 * is a static catalog: nothing is lost by giving up on it.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The provider did not respond in time.")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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
): Promise<ModelInfo[]> {
  const piProvider = toPiProviderId(provider);
  try {
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
