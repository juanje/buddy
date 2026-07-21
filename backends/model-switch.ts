// backends/model-switch.ts — Resolve Pi Model objects for session.setModel (FR-SETTINGS-03).

import type { SetupProviderId } from "../shared/api";
import { toPiProviderId } from "./provider-mapping";

export interface SessionModelLike {
  id: string;
  provider: string;
}

export interface ModelRuntimeForSwitch {
  getModel(providerId: string, modelId: string): SessionModelLike | undefined;
  getAvailable(providerId?: string): Promise<readonly SessionModelLike[]>;
}

/** Resolve a Pi Model for session.setModel from ab-app provider + model id. */
export async function resolveSessionModel(
  runtime: ModelRuntimeForSwitch,
  provider: SetupProviderId,
  modelId: string,
): Promise<SessionModelLike> {
  const piProvider = toPiProviderId(provider);
  const direct = runtime.getModel(piProvider, modelId);
  if (direct) return direct;

  const available = await runtime.getAvailable(piProvider);
  const match = available.find((m) => m.id === modelId);
  if (match) return match;

  throw new Error(`Model not found for ${provider}/${modelId}`);
}
