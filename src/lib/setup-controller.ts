// src/lib/setup-controller.ts — framework-agnostic setup wizard logic.
// The SetupWizard component is a thin view over these stores, mirroring the
// chat-controller pattern.

import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { recommendedModelFor } from "../../shared/model-catalog";
import { fromPiProviderId } from "../../shared/provider-mapping";
import { DEFAULT_SETUP_PROVIDER, isApiKeyOnlyProvider } from "./provider-setup";
import type {
  KeyCheck,
  LocationCheck,
  ModelInfo,
  OAuthUIEvent,
  PrereqStatus,
  SetupConfig,
  SetupWorkerAPI,
} from "../../shared/api";

export type ProviderId = SetupConfig["provider"];
export type AppLocale = NonNullable<SetupConfig["language"]>;

export type SetupStep =
  | "language"
  | "welcome"
  | "personalization"
  | "prerequisites"
  | "location"
  | "provider"
  | "model"
  | "creating";

export interface SetupController {
  step: Readable<SetupStep>;
  prereq: Readable<PrereqStatus | undefined>;
  checking: Readable<boolean>;
  language: Readable<AppLocale | undefined>;
  userName: Readable<string>;
  userAbout: Readable<string>;
  location: Readable<string | undefined>;
  locationCheck: Readable<LocationCheck | undefined>;
  provider: Readable<ProviderId | undefined>;
  needsBaseUrl: Readable<boolean>;
  keyCheck: Readable<KeyCheck | undefined>;
  validatingKey: Readable<boolean>;
  model: Readable<string | undefined>;
  canProceed: Readable<boolean>;
  oauthLoggingIn: Readable<boolean>;
  oauthError: Readable<string | undefined>;
  showApiKey: Readable<boolean>;
  authReady: Readable<boolean>;
  availableModels: Readable<ModelInfo[]>;
  loadingModels: Readable<boolean>;
  oauthPrompt: Readable<OAuthUIEvent | undefined>;

  read<T>(store: Readable<T>): T;
  selectLanguage(lang: AppLocale): void;
  setPersonalization(name: string, about?: string): void;
  checkPrerequisites(): Promise<void>;
  loadDefaultLocation(): Promise<string>;
  pickLocation(path: string): Promise<void>;
  selectProvider(provider: ProviderId): void;
  setShowApiKey(show: boolean): void;
  submitApiKey(apiKey: string, baseUrl?: string): Promise<void>;
  loginOAuth(): Promise<void>;
  handleOAuthEvent(event: OAuthUIEvent): void;
  answerOAuthPrompt(value: string): Promise<void>;
  cancelOAuthLogin(): Promise<void>;
  loadModels(): Promise<void>;
  selectModel(modelId: string): void;
  next(): void;
  back(): void;
  beginCreating(): void;
  finishSetup(): Promise<void>;
  importMode: Readable<boolean>;
  importExisting(): Promise<"adopted" | "needs-provider">;
  completed: Readable<boolean>;
  setupError: Readable<string | undefined>;
}

const STEP_ORDER: SetupStep[] = [
  "language",
  "welcome",
  "personalization",
  "prerequisites",
  "location",
  "provider",
  "model",
  "creating",
];

const USABLE_LOCATION: ReadonlyArray<LocationCheck["status"]> = ["ok-new", "ok-empty"];

export function createSetupController(worker: SetupWorkerAPI): SetupController {
  const step = writable<SetupStep>("language");
  const language = writable<AppLocale | undefined>(undefined);
  const userName = writable("");
  const userAbout = writable("");
  const prereq = writable<PrereqStatus | undefined>(undefined);
  const checking = writable(false);
  const location = writable<string | undefined>(undefined);
  const locationCheck = writable<LocationCheck | undefined>(undefined);
  const provider = writable<ProviderId | undefined>(undefined);
  const keyCheck = writable<KeyCheck | undefined>(undefined);
  const validatingKey = writable(false);
  const model = writable<string | undefined>(undefined);
  const oauthLoggingIn = writable(false);
  const oauthError = writable<string | undefined>(undefined);
  const showApiKey = writable(false);
  const authReady = writable(false);
  const availableModels = writable<ModelInfo[]>([]);
  const loadingModels = writable(false);
  const oauthPrompt = writable<OAuthUIEvent | undefined>(undefined);

  const needsBaseUrl = derived(provider, ($provider) => $provider === "custom");

  const canProceed = derived(
    [step, language, userName, prereq, locationCheck, authReady, model],
    ([$step, $language, $userName, $prereq, $locationCheck, $authReady, $model]) => {
      switch ($step) {
        case "language":
          return $language !== undefined;
        case "welcome":
          return true;
        case "personalization":
          return $userName.trim().length > 0;
        case "prerequisites":
          return $prereq?.gitInstalled === true;
        case "location":
          return $locationCheck !== undefined && USABLE_LOCATION.includes($locationCheck.status);
        case "provider":
          return $authReady;
        case "model":
          return typeof $model === "string" && $model.trim() !== "";
        default:
          return false;
      }
    },
  );

  function read<T>(store: Readable<T>): T {
    return get(store);
  }

  function selectLanguage(lang: AppLocale): void {
    language.set(lang);
    next();
  }

  function setPersonalization(name: string, about?: string): void {
    userName.set(name);
    userAbout.set(about ?? "");
  }

  async function checkPrerequisites(): Promise<void> {
    checking.set(true);
    try {
      prereq.set(await worker.checkPrerequisites());
    } finally {
      checking.set(false);
    }
  }

  async function loadDefaultLocation(): Promise<string> {
    const path = await worker.getDefaultLocation();
    if (get(location) === undefined) location.set(path);
    return path;
  }

  async function pickLocation(path: string): Promise<void> {
    location.set(path);
    locationCheck.set(await worker.validateLocation(path));
  }

  function selectProvider(id: ProviderId): void {
    provider.set(id);
    keyCheck.set(undefined);
    oauthError.set(undefined);
    authReady.set(false);
    showApiKey.set(isApiKeyOnlyProvider(id));
  }

  function setShowApiKey(show: boolean): void {
    showApiKey.set(show);
    oauthError.set(undefined);
  }

  async function submitApiKey(apiKey: string, baseUrl?: string): Promise<void> {
    const id = get(provider);
    if (!id) return;
    validatingKey.set(true);
    try {
      const result = await worker.configureProviderKey(id, apiKey, baseUrl);
      keyCheck.set(result);
      authReady.set(result.valid);
    } finally {
      validatingKey.set(false);
    }
  }

  async function loginOAuth(): Promise<void> {
    const id = get(provider);
    if (!id) return;
    oauthLoggingIn.set(true);
    oauthError.set(undefined);
    try {
      const result = await worker.loginOAuth(id);
      if (result.success) {
        authReady.set(true);
      } else if (result.error !== "Login cancelled") {
        oauthError.set(result.error);
      }
    } finally {
      oauthLoggingIn.set(false);
    }
  }

  function handleOAuthEvent(event: OAuthUIEvent): void {
    if (event.type === "prompt") {
      oauthPrompt.set(event);
    } else if (event.type === "error") {
      oauthError.set(event.message);
    } else if (event.type === "complete") {
      oauthPrompt.set(undefined);
    }
  }

  async function answerOAuthPrompt(value: string): Promise<void> {
    const prompt = get(oauthPrompt);
    if (prompt?.type === "prompt") {
      await worker.answerOAuthPrompt(prompt.requestId, value);
      oauthPrompt.set(undefined);
    }
  }

  async function cancelOAuthLogin(): Promise<void> {
    await worker.cancelOAuthLogin();
    oauthLoggingIn.set(false);
    oauthPrompt.set(undefined);
  }

  async function loadModels(): Promise<void> {
    const id = get(provider);
    if (!id || get(loadingModels)) return;
    loadingModels.set(true);
    try {
      const models = await worker.listModels(id);
      availableModels.set(models);
      if (get(model) === undefined && models.length > 0) {
        const recommended = models.find((m) => m.recommended) ?? models[0];
        model.set(recommended.id);
      }
    } finally {
      loadingModels.set(false);
    }
  }

  function selectModel(modelId: string): void {
    model.set(modelId);
  }

  const completed = writable(false);
  const setupError = writable<string | undefined>(undefined);
  const importMode = writable(false);

  function buildConfig(): SetupConfig {
    const rootDir = get(location);
    const providerId = get(provider);
    const modelId = get(model);
    if (!rootDir || !providerId || !modelId) {
      throw new Error("buildConfig called before the wizard collected all answers");
    }
    return {
      rootDir,
      provider: providerId,
      model: modelId,
      language: get(language) ?? "es",
      name: get(userName).trim(),
      about: get(userAbout).trim() || undefined,
    };
  }

  async function runSetupWith(config: SetupConfig): Promise<void> {
    setupError.set(undefined);
    try {
      await worker.runSetup(config, get(importMode) ? "import" : "create");
      completed.set(true);
    } catch (err) {
      setupError.set(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  function beginCreating(): void {
    step.set("creating");
  }

  async function finishSetup(): Promise<void> {
    await runSetupWith(buildConfig());
  }

  const KNOWN_PROVIDERS: ReadonlyArray<ProviderId> = ["anthropic", "openai", "google", "custom"];

  function resolveImportProvider(piOrAbProvider: string | undefined): ProviderId | undefined {
    if (!piOrAbProvider) return undefined;
    const fromPi = fromPiProviderId(piOrAbProvider);
    if (fromPi) return fromPi;
    if (KNOWN_PROVIDERS.includes(piOrAbProvider as ProviderId)) {
      return piOrAbProvider as ProviderId;
    }
    return undefined;
  }

  async function importExisting(): Promise<"adopted" | "needs-provider"> {
    const rootDir = get(location);
    const check = get(locationCheck);
    if (!rootDir || check?.status !== "existing-ab") {
      throw new Error("importExisting called without an existing AB at the chosen location");
    }
    importMode.set(true);

    const settings = check.abSettings;
    const knownProvider = resolveImportProvider(settings?.provider);
    if (knownProvider && settings?.model) {
      provider.set(knownProvider);
      model.set(settings.model);

      const authStatus = await worker.getAuthStatus();
      const providerAuth = authStatus.providers.find((p) => p.abProvider === knownProvider);
      if (providerAuth?.hasAuth) {
        await runSetupWith({
          rootDir,
          provider: knownProvider,
          model: settings.model,
          language: get(language) ?? "es",
        });
        return "adopted";
      }

      step.set("provider");
      return "needs-provider";
    }

    step.set("provider");
    return "needs-provider";
  }

  function next(): void {
    if (!get(canProceed)) return;
    step.update(($step) => {
      const index = STEP_ORDER.indexOf($step);
      let nextStep = STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
      if (nextStep === "prerequisites" && get(prereq)?.gitInstalled) {
        nextStep = "location";
      }
      return nextStep;
    });
    if (get(step) === "provider" && get(provider) === undefined) {
      provider.set(DEFAULT_SETUP_PROVIDER);
    }
    if (get(step) === "model" && get(model) === undefined) {
      const id = get(provider);
      if (id) model.set(recommendedModelFor(id)?.id);
    }
  }

  function back(): void {
    step.update(($step) => {
      const index = STEP_ORDER.indexOf($step);
      if (index <= 0) return $step;
      let prevStep = STEP_ORDER[index - 1];
      if (prevStep === "prerequisites" && get(prereq)?.gitInstalled) {
        prevStep = STEP_ORDER[index - 2] ?? "language";
      }
      return prevStep;
    });
  }

  return {
    step,
    prereq,
    checking,
    language,
    userName,
    userAbout,
    location,
    locationCheck,
    provider,
    needsBaseUrl,
    keyCheck,
    validatingKey,
    model,
    canProceed,
    oauthLoggingIn,
    oauthError,
    showApiKey,
    authReady,
    availableModels,
    loadingModels,
    oauthPrompt,
    read,
    selectLanguage,
    setPersonalization,
    checkPrerequisites,
    loadDefaultLocation,
    pickLocation,
    selectProvider,
    setShowApiKey,
    submitApiKey,
    loginOAuth,
    handleOAuthEvent,
    answerOAuthPrompt,
    cancelOAuthLogin,
    loadModels,
    selectModel,
    next,
    back,
    beginCreating,
    finishSetup,
    importMode,
    importExisting,
    completed,
    setupError,
  };
}
