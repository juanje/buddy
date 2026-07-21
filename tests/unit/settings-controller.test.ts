// tests/unit/settings-controller.test.ts — FR-SETTINGS-02 settings controller.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { getLocale } from "../../src/lib/i18n";
import {
  createSettingsController,
  isSettingsShortcut,
} from "../../src/lib/settings-controller";
import type { SetupConfig } from "../../shared/api";

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
      abDirectory: "/tmp/buddy",
      provider: "anthropic",
      model: "claude-sonnet-5",
      language: "es",
    };
    const calls: Array<Partial<Pick<SetupConfig, "language">>> = [];

    const controller = createSettingsController({
      worker: {
        updateConfig: async (patch) => {
          calls.push(patch);
          config = { ...config, ...patch };
        },
      },
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
});
