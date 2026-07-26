import type { SetupConfig, UsageReport } from "../../shared/api";
import type { SettingsWorkerAPI } from "../../src/lib/settings-controller";
import { catalogModelsFor } from "./setup-worker-fake";

export const DEFAULT_TEST_CONFIG: SetupConfig = {
  rootDir: "/tmp/buddy-test",
  provider: "anthropic",
  model: "claude-sonnet-5",
  language: "es",
  monthlyBudget: 10,
};

const DEFAULT_USAGE: UsageReport = {
  session: { totalCost: 0, totalTokens: 0, messageCount: 0 },
  monthly: { totalCost: 0, totalTokens: 0, messageCount: 0 },
  budget: { level: "ok", percent: 0, remaining: 10, budget: 10, monthlyCost: 0 },
};

export function buildMockWorker(overrides: Partial<SettingsWorkerAPI> = {}): SettingsWorkerAPI {
  return {
    updateConfig: async () => {},
    changeModel: async () => {},
    listModels: async (provider) => catalogModelsFor(provider),
    getUsage: async () => DEFAULT_USAGE,
    getAuthStatus: async () => ({
      providers: [
        { piProviderId: "anthropic", buddyProvider: "anthropic", hasAuth: true, authType: "oauth" },
        { piProviderId: "openai-codex", buddyProvider: "openai", hasAuth: false },
        { piProviderId: "google", buddyProvider: "google", hasAuth: false },
      ],
    }),
    loginOAuth: async () => ({ success: true }),
    configureProviderKey: async () => ({ valid: true }),
    ...overrides,
  };
}
