// tests/support/setup-worker-fake.ts — SetupWorkerAPI fake factory.
// Methods a scenario does not exercise throw loudly instead of returning
// silent defaults, so a step reaching the wrong surface fails visibly.

import type { ModelInfo, SetupProviderId, SetupWorkerAPI } from "../../shared/api";
import { modelChoicesFor } from "../../src/lib/model-catalog";

export function catalogModelsFor(provider: SetupProviderId): ModelInfo[] {
  const choices = modelChoicesFor(provider);
  if (!choices) return [];
  return choices.map((c) => ({
    id: c.id,
    label: c.label,
    provider,
    tier: c.tier,
    recommended: c.recommended,
  }));
}

export function makeSetupWorkerFake(overrides: Partial<SetupWorkerAPI>): SetupWorkerAPI {
  const notExercised = (name: string) => async () => {
    throw new Error(`${name} not exercised by this scenario`);
  };

  return {
    checkPrerequisites:
      overrides.checkPrerequisites ??
      (async () => ({ gitInstalled: true, gitVersion: "git version 2.44.0", platform: "darwin" })),
    getDefaultLocation: overrides.getDefaultLocation ?? notExercised("getDefaultLocation"),
    validateLocation: overrides.validateLocation ?? notExercised("validateLocation"),
    configureProviderKey: overrides.configureProviderKey ?? notExercised("configureProviderKey"),
    detectExistingAuth: overrides.detectExistingAuth ?? (async () => null),
    loginOAuth: overrides.loginOAuth ?? notExercised("loginOAuth"),
    answerOAuthPrompt: overrides.answerOAuthPrompt ?? notExercised("answerOAuthPrompt"),
    cancelOAuthLogin: overrides.cancelOAuthLogin ?? notExercised("cancelOAuthLogin"),
    listModels: overrides.listModels ?? (async (provider) => catalogModelsFor(provider)),
    getAuthStatus: overrides.getAuthStatus ?? notExercised("getAuthStatus"),
    runSetup: overrides.runSetup ?? notExercised("runSetup"),
  };
}
