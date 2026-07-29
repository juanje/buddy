// tests/unit/settings-controller.test.ts — FR-SETTINGS-02/03 settings controller.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import type { SetupConfig } from "../../shared/api";
import { buildMockWorker } from "../support/settings-fixtures";
import { catalogModelsFor } from "../support/setup-worker-fake";
import { getLocale } from "../../src/lib/i18n";
import {
  createSettingsController,
  isSettingsShortcut,
  type SettingsWorkerAPI,
} from "../../src/lib/settings-controller";

function mockWorker(overrides: Partial<SettingsWorkerAPI> = {}): SettingsWorkerAPI {
  return buildMockWorker(overrides);
}

describe("isSettingsShortcut", () => {
  it("detects Cmd/Ctrl+,", () => {
    expect(isSettingsShortcut({ key: ",", metaKey: true })).toBe(true);
    expect(isSettingsShortcut({ key: ",", ctrlKey: true })).toBe(true);
    expect(isSettingsShortcut({ key: ",", metaKey: false, ctrlKey: false })).toBe(false);
  });
});

describe("createSettingsController", () => {
  it("opens, changes language, and persists via worker", async () => {
    let config: SetupConfig = {
      rootDir: "/tmp/buddy",
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
      rootDir: "/tmp/buddy",
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
    expect(get(controller.models)).toHaveLength(catalogModelsFor("anthropic").length);
    expect(get(controller.unauthenticatedProviders)).toEqual(["openai", "google"]);
  });

  it("setModel calls changeModel and updates config", async () => {
    let config: SetupConfig = {
      rootDir: "/tmp/buddy",
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
      rootDir: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };

    const controller = createSettingsController({
      worker: mockWorker({
        getAuthStatus: async () => ({
          providers: [
            { piProviderId: "anthropic", buddyProvider: "anthropic", hasAuth: true },
            { piProviderId: "openai-codex", buddyProvider: "openai", hasAuth: true },
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
      rootDir: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };
    let openAiAuthed = false;

    const controller = createSettingsController({
      worker: mockWorker({
        getAuthStatus: async () => ({
          providers: [
            { piProviderId: "anthropic", buddyProvider: "anthropic", hasAuth: true },
            {
              piProviderId: "openai-codex",
              buddyProvider: "openai",
              hasAuth: openAiAuthed,
            },
            { piProviderId: "google", buddyProvider: "google", hasAuth: false },
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

  // FR-SETUP-05. The wizard and this panel each implement the "cancelling is
  // not an error" policy, because their success paths are too different to
  // share (the wizard unlocks one step; this refreshes one provider's models
  // and collapses the panel). A common runner was considered and rejected for
  // the reason NFR-SEC-14 records. What that costs is this: the policy is
  // written twice, so it is pinned twice.
  it.each([
    ["a cancelled login", { success: false, cancelled: true, error: "aborted" }, undefined],
    ["a failed login", { success: false, cancelled: false, error: "provider down" }, "provider down"],
  ] as const)("%s leaves the panel open and shows %#", async (_label, result, expectedError) => {
    let config: SetupConfig = {
      rootDir: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };

    const controller = createSettingsController({
      worker: mockWorker({ loginOAuth: async () => result }),
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

    expect(get(controller.authError)).toBe(expectedError);
    // Either way the user stays where they were; nothing was added.
    expect(get(controller.addingProvider)).toBe(true);
    expect(get(controller.providerAddedNotice)).toBe(false);
  });
});
