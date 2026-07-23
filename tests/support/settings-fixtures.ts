import type { SetupConfig } from "../../shared/api";
import type { SettingsWorkerAPI } from "../../src/lib/settings-controller";
import { catalogModelsFor } from "./setup-worker-fake";

export const DEFAULT_TEST_CONFIG: SetupConfig = {
  rootDir: "/tmp/buddy-test",
  provider: "anthropic",
  model: "claude-sonnet-5",
  language: "es",
};

export function buildMockWorker(overrides: Partial<SettingsWorkerAPI> = {}): SettingsWorkerAPI {
  return {
    updateConfig: async () => {},
    changeModel: async () => {},
    listModels: async (provider) => catalogModelsFor(provider),
    getAuthStatus: async () => ({
      providers: [
        { piProviderId: "anthropic", abProvider: "anthropic", hasAuth: true, authType: "oauth" },
        { piProviderId: "openai-codex", abProvider: "openai", hasAuth: false },
        { piProviderId: "google", abProvider: "google", hasAuth: false },
      ],
    }),
    loginOAuth: async () => ({ success: true }),
    configureProviderKey: async () => ({ valid: true }),
    ...overrides,
  };
}
