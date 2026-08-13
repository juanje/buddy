// src/lib/settings-controller.ts — Settings modal state (FR-SETTINGS-02/03).

import { get, writable, type Readable, type Writable } from "svelte/store";

import type {
  AuthStatusResult,
  KeyCheck,
  ModelInfo,
  OAuthLoginResult,
  OAuthUIEvent,
  SetupConfig,
  UsageReport,
} from "../../shared/api";
import { DEFAULT_MONTHLY_BUDGET } from "../../shared/defaults";
import { getLocale, setLocale, type AppLocale } from "./i18n";
import { isApiKeyOnlyProvider } from "./provider-setup";

export interface SettingsWorkerAPI {
  updateConfig(patch: Partial<Pick<SetupConfig, "language" | "monthlyBudget">>): Promise<void>;
  changeModel(provider: SetupConfig["provider"], model: string): Promise<void>;
  listModels(provider: SetupConfig["provider"]): Promise<ModelInfo[]>;
  getAuthStatus(): Promise<AuthStatusResult>;
  loginOAuth(provider: SetupConfig["provider"]): Promise<OAuthLoginResult>;
  configureProviderKey(
    provider: SetupConfig["provider"],
    apiKey: string,
    baseUrl?: string,
  ): Promise<KeyCheck>;
  getUsage(): Promise<UsageReport>;
}

export interface SettingsDisplayConfig {
  language: AppLocale;
  provider: SetupConfig["provider"];
  model: string;
  rootDir: string;
  version: string;
  monthlyBudget: number | null;
}

function formatUsd(amount: number): string {
  return amount.toFixed(2);
}

export type SettingsProviderId = SetupConfig["provider"];

const ADD_PROVIDER_CANDIDATES: SettingsProviderId[] = ["openai", "anthropic", "google"];

export interface SettingsController {
  open: Readable<boolean>;
  config: Readable<SettingsDisplayConfig>;
  models: Readable<ModelInfo[]>;
  loadingModels: Readable<boolean>;
  addingProvider: Readable<boolean>;
  authProvider: Readable<SettingsProviderId | undefined>;
  authLoggingIn: Readable<boolean>;
  authError: Readable<string | undefined>;
  authShowApiKey: Readable<boolean>;
  /** OpenAI device-code challenge while Settings OAuth is in flight (NFR-PORT-10). */
  authDeviceCode: Readable<Extract<OAuthUIEvent, { type: "device_code" }> | undefined>;
  unauthenticatedProviders: Readable<SettingsProviderId[]>;
  providerAddedNotice: Readable<boolean>;
  usage: Readable<UsageReport | undefined>;
  usageLoading: Readable<boolean>;
  openSettings(): void;
  closeSettings(): void;
  setLanguage(language: AppLocale): Promise<void>;
  setModel(provider: SettingsProviderId, model: string): Promise<void>;
  getLastModelForProvider(provider: SettingsProviderId): string | undefined;
  startAddProvider(preferred?: SettingsProviderId): void;
  cancelAddProvider(): void;
  selectAuthProvider(provider: SettingsProviderId): void;
  submitAuthOAuth(): Promise<void>;
  submitAuthApiKey(apiKey: string, baseUrl?: string): Promise<void>;
  setAuthShowApiKey(show: boolean): void;
  handleOAuthEvent(event: OAuthUIEvent): void;
  setMonthlyBudget(amount: number | null): Promise<void>;
  formatCost(amount: number): string;
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
  const rawBudget = config.monthlyBudget;
  const monthlyBudget =
    rawBudget === 0 || rawBudget === null
      ? null
      : rawBudget ?? DEFAULT_MONTHLY_BUDGET;
  return {
    language: config.language ?? getLocale(),
    provider: config.provider,
    model: config.model,
    rootDir: config.rootDir,
    version,
    monthlyBudget,
  };
}

async function loadAuthenticatedModels(
  worker: SettingsWorkerAPI,
): Promise<{ models: ModelInfo[]; unauthenticated: SettingsProviderId[] }> {
  const status = await worker.getAuthStatus();
  const authed = new Set(
    status.providers.filter((p) => p.hasAuth).map((p) => p.buddyProvider),
  );
  const unauthenticated = ADD_PROVIDER_CANDIDATES.filter((p) => !authed.has(p));
  const providers = [...authed].filter((p): p is SettingsProviderId => p !== "custom");
  const lists = await Promise.all(providers.map((provider) => worker.listModels(provider)));
  return { models: lists.flat(), unauthenticated };
}

export function createSettingsController(options: {
  worker: SettingsWorkerAPI;
  getConfig: () => SetupConfig;
  onConfigChange: (config: SetupConfig) => void;
  version: string;
}): SettingsController {
  const open: Writable<boolean> = writable(false);
  const config = writable<SettingsDisplayConfig>(toDisplay(options.getConfig(), options.version));
  const models = writable<ModelInfo[]>([]);
  const loadingModels = writable(false);
  const addingProvider = writable(false);
  const authProvider = writable<SettingsProviderId | undefined>(undefined);
  const authLoggingIn = writable(false);
  const authError = writable<string | undefined>(undefined);
  const authShowApiKey = writable(false);
  const authDeviceCode = writable<Extract<OAuthUIEvent, { type: "device_code" }> | undefined>(
    undefined,
  );
  const unauthenticatedProviders = writable<SettingsProviderId[]>([]);
  const providerAddedNotice = writable(false);
  const usage = writable<UsageReport | undefined>(undefined);
  const usageLoading = writable(false);
  const lastModelByProvider = new Map<SettingsProviderId, string>();

  async function refreshUsage(): Promise<void> {
    usageLoading.set(true);
    try {
      usage.set(await options.worker.getUsage());
    } catch {
      usage.set(undefined);
    } finally {
      usageLoading.set(false);
    }
  }

  async function refreshModels(): Promise<void> {
    loadingModels.set(true);
    try {
      const result = await loadAuthenticatedModels(options.worker);
      models.set(result.models);
      unauthenticatedProviders.set(result.unauthenticated);
    } finally {
      loadingModels.set(false);
    }
  }

  async function refreshModelsForProvider(provider: SettingsProviderId): Promise<void> {
    const newModels = await options.worker.listModels(provider);
    models.update((current) => {
      const without = current.filter((m) => m.provider !== provider);
      return [...without, ...newModels];
    });
    unauthenticatedProviders.update((list) => list.filter((p) => p !== provider));
  }

  return {
    open,
    config,
    models,
    loadingModels,
    addingProvider,
    authProvider,
    authLoggingIn,
    authError,
    authShowApiKey,
    authDeviceCode,
    unauthenticatedProviders,
    providerAddedNotice,
    usage,
    usageLoading,
    openSettings() {
      const current = options.getConfig();
      config.set(toDisplay(current, options.version));
      lastModelByProvider.clear();
      // Seeded from the stored history, not just the active provider: the Map
      // used to be wiped here, so the memory lasted only while the panel
      // stayed open and switching back after reopening fell through to the
      // provider's first listed model.
      for (const [provider, model] of Object.entries(current.modelByProvider ?? {})) {
        if (model) lastModelByProvider.set(provider as SettingsProviderId, model);
      }
      lastModelByProvider.set(current.provider, current.model);
      addingProvider.set(false);
      authProvider.set(undefined);
      authError.set(undefined);
      authShowApiKey.set(false);
      providerAddedNotice.set(false);
      open.set(true);
      void refreshModels();
      void refreshUsage();
    },
    closeSettings() {
      open.set(false);
      addingProvider.set(false);
      authProvider.set(undefined);
      authError.set(undefined);
    },
    async setLanguage(language) {
      setLocale(language);
      await options.worker.updateConfig({ language });
      const updated: SetupConfig = { ...options.getConfig(), language };
      options.onConfigChange(updated);
      config.update((current) => ({ ...current, language }));
    },
    async setModel(provider, model) {
      lastModelByProvider.set(provider, model);
      const previous = options.getConfig();
      // Recorded here too, not only by the worker. The worker writes
      // config.json immediately, but the panel reads the frontend's own copy
      // of the config — so leaving this out meant the choice was on disk and
      // invisible until the app restarted.
      const modelByProvider = { ...(previous.modelByProvider ?? {}), [provider]: model };
      const updated: SetupConfig = { ...previous, provider, model, modelByProvider };
      options.onConfigChange(updated);
      config.update((current) => ({ ...current, provider, model }));
      try {
        await options.worker.changeModel(provider, model);
      } catch {
        options.onConfigChange(previous);
        config.update((current) => ({
          ...current,
          provider: previous.provider,
          model: previous.model,
        }));
        lastModelByProvider.set(previous.provider, previous.model);
      }
    },
    getLastModelForProvider(provider) {
      return lastModelByProvider.get(provider);
    },
    startAddProvider(preferred?: SettingsProviderId) {
      addingProvider.set(true);
      authProvider.set(preferred);
      authError.set(undefined);
      authDeviceCode.set(undefined);
      authShowApiKey.set(preferred ? isApiKeyOnlyProvider(preferred) : false);
      providerAddedNotice.set(false);
    },
    cancelAddProvider() {
      addingProvider.set(false);
      authProvider.set(undefined);
      authError.set(undefined);
      authDeviceCode.set(undefined);
      authShowApiKey.set(false);
    },
    selectAuthProvider(provider) {
      authProvider.set(provider);
      authError.set(undefined);
      authDeviceCode.set(undefined);
      authShowApiKey.set(isApiKeyOnlyProvider(provider));
    },
    handleOAuthEvent(event: OAuthUIEvent) {
      if (event.type === "device_code") {
        authDeviceCode.set(event);
      } else if (event.type === "complete" || event.type === "error") {
        authDeviceCode.set(undefined);
      }
    },
    async submitAuthOAuth() {
      const provider = get(authProvider);
      if (!provider) return;
      authLoggingIn.set(true);
      authError.set(undefined);
      authDeviceCode.set(undefined);
      try {
        const result = await options.worker.loginOAuth(provider);
        if (!result.success) {
          // Cancelling is a decision, not a failure (FR-SETUP-05).
          if (!result.cancelled) {
            authError.set(result.error);
          }
          return;
        }
        await refreshModelsForProvider(provider);
        addingProvider.set(false);
        authProvider.set(undefined);
        providerAddedNotice.set(true);
      } finally {
        authLoggingIn.set(false);
        authDeviceCode.set(undefined);
      }
    },
    async submitAuthApiKey(apiKey, baseUrl) {
      const provider = get(authProvider);
      if (!provider) return;
      authLoggingIn.set(true);
      authError.set(undefined);
      try {
        const result = await options.worker.configureProviderKey(provider, apiKey, baseUrl);
        if (!result.valid) {
          authError.set(result.error);
          return;
        }
        await refreshModelsForProvider(provider);
        addingProvider.set(false);
        authProvider.set(undefined);
        providerAddedNotice.set(true);
      } finally {
        authLoggingIn.set(false);
      }
    },
    setAuthShowApiKey(show) {
      authShowApiKey.set(show);
      authError.set(undefined);
    },
    async setMonthlyBudget(amount) {
      await options.worker.updateConfig({ monthlyBudget: amount });
      const updated: SetupConfig = { ...options.getConfig(), monthlyBudget: amount };
      options.onConfigChange(updated);
      config.update((current) => ({ ...current, monthlyBudget: amount }));
      await refreshUsage();
    },
    formatCost: formatUsd,
  };
}

/** True when the user pressed the platform settings shortcut (Cmd/Ctrl+,). */
export function isSettingsShortcut(event: { key: string; metaKey?: boolean; ctrlKey?: boolean }): boolean {
  return event.key === "," && (event.metaKey === true || event.ctrlKey === true);
}
