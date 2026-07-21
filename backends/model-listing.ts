// backends/model-listing.ts — live model list + curated fallback (FR-SETUP-05).

import type { ModelInfo, SetupProviderId } from "../shared/api";
import {
  modelChoicesFor,
  recommendedModelFor,
  type ModelChoice,
} from "../shared/model-catalog";
import { toPiProviderId } from "./provider-mapping";

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

/** List models: live SDK first, curated catalog if empty or unavailable. */
export async function listModelsForProvider(
  runtime: ModelRuntimeLike,
  provider: SetupProviderId,
): Promise<ModelInfo[]> {
  const piProvider = toPiProviderId(provider);
  try {
    const available = await runtime.getAvailable(piProvider);
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
    // Offline or auth not ready — fall through to catalog.
  }
  return fromCatalog(provider);
}
