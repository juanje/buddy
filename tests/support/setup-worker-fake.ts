// tests/support/setup-worker-fake.ts — SetupWorkerAPI fake factory.
// Methods a scenario does not exercise throw loudly instead of returning
// silent defaults, so a step reaching the wrong surface fails visibly.

import type { SetupWorkerAPI } from "../../shared/api";

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
    runSetup: overrides.runSetup ?? notExercised("runSetup"),
  };
}
