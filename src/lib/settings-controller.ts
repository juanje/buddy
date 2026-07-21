// src/lib/settings-controller.ts — Settings modal state (FR-SETTINGS-02).

import { get, writable, type Readable, type Writable } from "svelte/store";

import type { SetupConfig } from "../../shared/api";
import { getLocale, setLocale, type AppLocale } from "./i18n";

export interface SettingsWorkerAPI {
  updateConfig(patch: Partial<Pick<SetupConfig, "language">>): Promise<void>;
}

export interface SettingsDisplayConfig {
  language: AppLocale;
  provider: SetupConfig["provider"];
  model: string;
  abDirectory: string;
  version: string;
}

export interface SettingsController {
  open: Readable<boolean>;
  config: Readable<SettingsDisplayConfig>;
  openSettings(): void;
  closeSettings(): void;
  setLanguage(language: AppLocale): Promise<void>;
}

export function providerLabel(
  provider: SetupConfig["provider"],
  labels: {
    providerAnthropic: string;
    providerOpenai: string;
    providerGoogle: string;
    providerCustom: string;
  },
): string {
  switch (provider) {
    case "anthropic":
      return labels.providerAnthropic;
    case "openai":
      return labels.providerOpenai;
    case "google":
      return labels.providerGoogle;
    case "custom":
      return labels.providerCustom;
  }
}

function toDisplay(config: SetupConfig, version: string): SettingsDisplayConfig {
  return {
    language: config.language ?? getLocale(),
    provider: config.provider,
    model: config.model,
    abDirectory: config.abDirectory,
    version,
  };
}

export function createSettingsController(options: {
  worker: SettingsWorkerAPI;
  getConfig: () => SetupConfig;
  onConfigChange: (config: SetupConfig) => void;
  version: string;
}): SettingsController {
  const open: Writable<boolean> = writable(false);
  const config = writable<SettingsDisplayConfig>(toDisplay(options.getConfig(), options.version));

  return {
    open,
    config,
    openSettings() {
      config.set(toDisplay(options.getConfig(), options.version));
      open.set(true);
    },
    closeSettings() {
      open.set(false);
    },
    async setLanguage(language) {
      setLocale(language);
      await options.worker.updateConfig({ language });
      const updated: SetupConfig = { ...options.getConfig(), language };
      options.onConfigChange(updated);
      config.update((current) => ({ ...current, language }));
    },
  };
}

/** True when the user pressed the platform settings shortcut (Cmd/Ctrl+,). */
export function isSettingsShortcut(event: { key: string; metaKey?: boolean; ctrlKey?: boolean }): boolean {
  return event.key === "," && (event.metaKey === true || event.ctrlKey === true);
}

export function readSettingsOpen(open: Readable<boolean>): boolean {
  return get(open);
}
