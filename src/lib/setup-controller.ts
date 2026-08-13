// src/lib/setup-controller.ts — framework-agnostic setup wizard logic.
// The SetupWizard component is a thin view over these stores, mirroring the
// chat-controller pattern.

import { derived, get, writable, type Readable } from "svelte/store";
import { recommendedModelFor } from "../../shared/model-catalog";
import { DEFAULT_LANGUAGE } from "../../shared/defaults";
import { fromPiProviderId } from "../../shared/provider-mapping";
import { DEFAULT_SETUP_PROVIDER, isApiKeyOnlyProvider } from "./provider-setup";
import type { AppLocale } from "./i18n";
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
  /** The typed path changed, so the last validation no longer applies. */
  locationInputChanged(): void;
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

const KNOWN_PROVIDERS: ReadonlyArray<ProviderId> = ["anthropic", "openai", "google", "custom"];

/**
 * Map a provider id from an existing instance's `.pi/settings.json` to Buddy's
 * own provider id, for FR-SETUP-10 import.
 *
 * Hoisted out of `createSetupController` rather than left as a nested
 * function: it closed over nothing but this module-level constant, so moving
 * it changes nothing about behaviour and makes it testable without
 * constructing a controller or a worker fake.
 */
export function resolveImportProvider(piOrBuddyProvider: string | undefined): ProviderId | undefined {
  if (!piOrBuddyProvider) return undefined;
  const fromPi = fromPiProviderId(piOrBuddyProvider);
  if (fromPi) return fromPi;
  if (KNOWN_PROVIDERS.includes(piOrBuddyProvider as ProviderId)) {
    return piOrBuddyProvider as ProviderId;
  }
  return undefined;
}

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

  // Bumped on every pick, so a validation that started for an earlier path
  // can recognize it is no longer the latest and discard its own result
  // instead of overwriting a newer one that already resolved. Reported from
  // real use: pick a slow-to-validate directory, then pick a fast one before
  // the first answer comes back — without this, the stale answer for the
  // first path won the race and stuck the wizard on "import only" no matter
  // how many times the user picked a fresh directory afterward.
  let locationPickToken = 0;

  async function pickLocation(path: string): Promise<void> {
    const token = ++locationPickToken;
    location.set(path);
    const check = await worker.validateLocation(path);
    if (token !== locationPickToken) return;
    locationCheck.set(check);
  }

  /**
   * The typed path no longer matches what was validated, so the previous
   * verdict is void.
   *
   * Without this the wizard could act on a directory the user was no longer
   * looking at. Reported from real use: the check said "existing-buddy", which
   * swaps Continue for Import; typing a different path changed the box but not
   * the controller, and Import then adopted the *previous* directory. The user
   * only noticed because the assistant already knew things about them.
   */
  function locationInputChanged(): void {
    // Also discards any validation still in flight, so a late answer for the
    // old path cannot reinstate the verdict this just cleared.
    locationPickToken++;
    locationCheck.set(undefined);
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
    oauthPrompt.set(undefined);
    try {
      const result = await worker.loginOAuth(id);
      if (result.success) {
        authReady.set(true);
      } else if (!result.cancelled) {
        // Cancelling is a decision, not a failure (FR-SETUP-05).
        oauthError.set(result.error);
      }
    } finally {
      oauthLoggingIn.set(false);
      oauthPrompt.set(undefined);
    }
  }

  function handleOAuthEvent(event: OAuthUIEvent): void {
    if (event.type === "prompt" || event.type === "device_code") {
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
      language: get(language) ?? DEFAULT_LANGUAGE,
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

  async function importExisting(): Promise<"adopted" | "needs-provider"> {
    const rootDir = get(location);
    const check = get(locationCheck);
    if (!rootDir || check?.status !== "existing-buddy") {
      throw new Error("importExisting called without an existing buddy instance at the chosen location");
    }
    importMode.set(true);

    const settings = check.buddySettings;
    const knownProvider = resolveImportProvider(settings?.provider);
    if (knownProvider && settings?.model) {
      provider.set(knownProvider);
      model.set(settings.model);

      const authStatus = await worker.getAuthStatus();
      const providerAuth = authStatus.providers.find((p) => p.buddyProvider === knownProvider);
      if (providerAuth?.hasAuth) {
        await runSetupWith({
          rootDir,
          provider: knownProvider,
          model: settings.model,
          language: get(language) ?? DEFAULT_LANGUAGE,
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
    locationInputChanged,
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
