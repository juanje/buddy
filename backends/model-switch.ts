// backends/model-switch.ts — Resolve Pi Model objects for session.setModel (FR-SETTINGS-03).

import type { SetupProviderId } from "../shared/api";
import { modelChoicesFor } from "../shared/model-catalog";
import { type AuthType, toPiProviderId } from "../shared/provider-mapping";

export interface SessionModelLike {
  id: string;
  provider: string;
}

export interface ModelRuntimeForSwitch {
  getModel(providerId: string, modelId: string): SessionModelLike | undefined;
  getAvailable(providerId?: string): Promise<readonly SessionModelLike[]>;
}

/** Resolve a Pi Model for session.setModel from Buddy provider + model id. */
export async function resolveSessionModel(
  runtime: ModelRuntimeForSwitch,
  provider: SetupProviderId,
  modelId: string,
  authType?: AuthType,
): Promise<SessionModelLike> {
  const piProvider = toPiProviderId(provider, authType);
  const direct = runtime.getModel(piProvider, modelId);
  if (direct) return direct;

  const available = await runtime.getAvailable(piProvider);
  const match = available.find((m) => m.id === modelId);
  if (match) return match;

  // The runtime's availability snapshot can lag behind a just-configured
  // provider (e.g. setRuntimeApiKey for an API-key provider): the model
  // dropdown already showed this id via listModelsForProvider's catalog
  // fallback, so resolving the switch must accept the same fallback rather
  // than throwing for a model the user just picked (FR-SETTINGS-03b).
  const catalog = modelChoicesFor(provider);
  const catalogMatch = catalog?.find((c) => c.id === modelId);
  if (catalogMatch) return { id: catalogMatch.id, provider: piProvider };

  throw new Error(`Model not found for ${provider}/${modelId}`);
}
