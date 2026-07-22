import type { ModelInfo, SetupConfig } from "../../shared/api";
import type { SettingsWorkerAPI } from "../../src/lib/settings-controller";

export const DEFAULT_TEST_CONFIG: SetupConfig = {
  rootDir: "/tmp/buddy-test",
  provider: "anthropic",
  model: "claude-sonnet-5",
  language: "es",
};

export const MODEL_CATALOG: Record<SetupConfig["provider"], ModelInfo[]> = {
  anthropic: [
    { id: "claude-sonnet-5", label: "Claude Sonnet", provider: "anthropic" },
    { id: "claude-haiku-4-5", label: "Claude Haiku", provider: "anthropic" },
  ],
  openai: [{ id: "gpt-5", label: "GPT-5", provider: "openai" }],
  google: [{ id: "gemini-3.5-flash", label: "Gemini Flash", provider: "google" }],
  custom: [],
};

export function buildMockWorker(overrides: Partial<SettingsWorkerAPI> = {}): SettingsWorkerAPI {
  return {
    updateConfig: async () => {},
    changeModel: async () => {},
    listModels: async (provider) => MODEL_CATALOG[provider] ?? [],
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
