// tests/unit/settings-controller.test.ts — FR-SETTINGS-02/03 settings controller.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { getLocale } from "../../src/lib/i18n";
import {
  createSettingsController,
  groupModelsByProvider,
  isSettingsShortcut,
  modelSelectValue,
  parseModelSelectValue,
  type SettingsWorkerAPI,
} from "../../src/lib/settings-controller";
import type { ModelInfo, SetupConfig } from "../../shared/api";

function mockWorker(overrides: Partial<SettingsWorkerAPI> = {}): SettingsWorkerAPI {
  return {
    updateConfig: async () => {},
    changeModel: async () => {},
    listModels: async (provider) => {
      if (provider === "anthropic") {
        return [
          { id: "claude-sonnet-5", label: "Claude Sonnet", provider: "anthropic" },
          { id: "claude-haiku-4-5", label: "Claude Haiku", provider: "anthropic" },
        ];
      }
      if (provider === "openai") {
        return [{ id: "gpt-5", label: "GPT-5", provider: "openai" }];
      }
      return [];
    },
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

describe("isSettingsShortcut", () => {
  it("detects Cmd/Ctrl+,", () => {
    expect(isSettingsShortcut({ key: ",", metaKey: true })).toBe(true);
    expect(isSettingsShortcut({ key: ",", ctrlKey: true })).toBe(true);
    expect(isSettingsShortcut({ key: ",", metaKey: false, ctrlKey: false })).toBe(false);
  });
});

describe("modelSelectValue helpers", () => {
  it("round-trips provider and model id", () => {
    const value = modelSelectValue("openai", "gpt-5");
    expect(parseModelSelectValue(value)).toEqual({ provider: "openai", model: "gpt-5" });
  });
});

describe("groupModelsByProvider", () => {
  it("groups models with provider labels", () => {
    const models: ModelInfo[] = [
      { id: "gpt-5", label: "GPT-5", provider: "openai" },
      { id: "claude-sonnet-5", label: "Claude Sonnet", provider: "anthropic" },
    ];
    const groups = groupModelsByProvider(models, {
      providerAnthropic: "Anthropic",
      providerOpenai: "OpenAI",
      providerGoogle: "Google",
      providerCustom: "Custom",
    });
    expect(groups.map((g) => g.provider)).toEqual(["openai", "anthropic"]);
    expect(groups[0].models).toHaveLength(1);
  });
});

describe("createSettingsController", () => {
  it("opens, changes language, and persists via worker", async () => {
    let config: SetupConfig = {
      abDirectory: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };
    const calls: Array<Partial<Pick<SetupConfig, "language">>> = [];

    const controller = createSettingsController({
      worker: mockWorker({
        updateConfig: async (patch) => {
          calls.push(patch);
          config = { ...config, ...patch };
        },
      }),
      getConfig: () => config,
      onConfigChange: (next) => {
        config = next;
      },
      version: "0.1.0-test",
    });

    controller.openSettings();
    expect(get(controller.open)).toBe(true);
    await controller.setLanguage("en");
    expect(getLocale()).toBe("en");
    expect(config.language).toBe("en");
    expect(calls).toEqual([{ language: "en" }]);
    controller.closeSettings();
    expect(get(controller.open)).toBe(false);
  });

  it("loads models from authenticated providers on open", async () => {
    let config: SetupConfig = {
      abDirectory: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };

    const controller = createSettingsController({
      worker: mockWorker(),
      getConfig: () => config,
      onConfigChange: (next) => {
        config = next;
      },
      version: "0.1.0-test",
    });

    controller.openSettings();
    await new Promise((r) => setTimeout(r, 0));
    expect(get(controller.models)).toHaveLength(2);
    expect(get(controller.unauthenticatedProviders)).toEqual(["openai", "google"]);
  });

  it("setModel calls changeModel and updates config", async () => {
    let config: SetupConfig = {
      abDirectory: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };
    const changeCalls: Array<{ provider: SetupConfig["provider"]; model: string }> = [];

    const controller = createSettingsController({
      worker: mockWorker({
        changeModel: async (provider, model) => {
          changeCalls.push({ provider, model });
        },
      }),
      getConfig: () => config,
      onConfigChange: (next) => {
        config = next;
      },
      version: "0.1.0-test",
    });

    await controller.setModel("anthropic", "claude-haiku-4-5");
    expect(changeCalls).toEqual([{ provider: "anthropic", model: "claude-haiku-4-5" }]);
    expect(config.model).toBe("claude-haiku-4-5");
    expect(get(controller.config).model).toBe("claude-haiku-4-5");
  });

  it("remembers last selected model per provider across switches", async () => {
    let config: SetupConfig = {
      abDirectory: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };

    const controller = createSettingsController({
      worker: mockWorker({
        getAuthStatus: async () => ({
          providers: [
            { piProviderId: "anthropic", abProvider: "anthropic", hasAuth: true },
            { piProviderId: "openai-codex", abProvider: "openai", hasAuth: true },
          ],
        }),
      }),
      getConfig: () => config,
      onConfigChange: (next) => {
        config = next;
      },
      version: "0.1.0-test",
    });

    controller.openSettings();
    expect(controller.getLastModelForProvider("anthropic")).toBe("claude-sonnet-5");

    await controller.setModel("anthropic", "claude-haiku-4-5");
    expect(controller.getLastModelForProvider("anthropic")).toBe("claude-haiku-4-5");

    await controller.setModel("openai", "gpt-5");
    expect(controller.getLastModelForProvider("openai")).toBe("gpt-5");

    expect(controller.getLastModelForProvider("anthropic")).toBe("claude-haiku-4-5");

    expect(controller.getLastModelForProvider("google")).toBeUndefined();
  });

  it("add-provider OAuth flow refreshes models and collapses section", async () => {
    let config: SetupConfig = {
      abDirectory: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };
    let openAiAuthed = false;

    const controller = createSettingsController({
      worker: mockWorker({
        getAuthStatus: async () => ({
          providers: [
            { piProviderId: "anthropic", abProvider: "anthropic", hasAuth: true },
            {
              piProviderId: "openai-codex",
              abProvider: "openai",
              hasAuth: openAiAuthed,
            },
            { piProviderId: "google", abProvider: "google", hasAuth: false },
          ],
        }),
        loginOAuth: async (provider) => {
          if (provider === "openai") openAiAuthed = true;
          return { success: true };
        },
      }),
      getConfig: () => config,
      onConfigChange: (next) => {
        config = next;
      },
      version: "0.1.0-test",
    });

    controller.openSettings();
    await new Promise((r) => setTimeout(r, 0));
    controller.startAddProvider();
    controller.selectAuthProvider("openai");
    await controller.submitAuthOAuth();

    expect(get(controller.addingProvider)).toBe(false);
    expect(get(controller.providerAddedNotice)).toBe(true);
    expect(get(controller.models).some((m) => m.provider === "openai")).toBe(true);
    expect(get(controller.unauthenticatedProviders)).not.toContain("openai");
  });
});
