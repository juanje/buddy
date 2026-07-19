// src/lib/setup-controller.ts — framework-agnostic setup wizard logic.
// The SetupWizard component is a thin view over these stores, mirroring the
// chat-controller pattern.

import { derived, get, writable, type Readable } from "svelte/store";
import { recommendedModelFor } from "./model-catalog";
import type {
  KeyCheck,
  LocationCheck,
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

  selectLanguage(lang: AppLocale): void;
  setPersonalization(name: string, about?: string): void;
  checkPrerequisites(): Promise<void>;
  loadDefaultLocation(): Promise<string>;
  pickLocation(path: string): Promise<void>;
  selectProvider(provider: ProviderId): void;
  submitApiKey(apiKey: string, baseUrl?: string): Promise<void>;
  selectModel(modelId: string): void;
  next(): void;
  /** Move to the creating step without running setup yet (shows chat during warm handoff). */
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

  const needsBaseUrl = derived(provider, ($provider) => $provider === "custom");

  const canProceed = derived(
    [step, language, userName, prereq, locationCheck, keyCheck, model],
    ([$step, $language, $userName, $prereq, $locationCheck, $keyCheck, $model]) => {
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
          return $keyCheck?.valid === true;
        case "model":
          return typeof $model === "string" && $model.trim() !== "";
        default:
          return false;
      }
    },
  );

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
  }

  async function submitApiKey(apiKey: string, baseUrl?: string): Promise<void> {
    const id = get(provider);
    if (!id) return;
    validatingKey.set(true);
    try {
      keyCheck.set(await worker.configureProviderKey(id, apiKey, baseUrl));
    } finally {
      validatingKey.set(false);
    }
  }

  function selectModel(modelId: string): void {
    model.set(modelId);
  }

  const completed = writable(false);
  const setupError = writable<string | undefined>(undefined);
  const importMode = writable(false);

  function buildConfig(): SetupConfig {
    const abDirectory = get(location);
    const providerId = get(provider);
    const modelId = get(model);
    if (!abDirectory || !providerId || !modelId) {
      throw new Error("buildConfig called before the wizard collected all answers");
    }
    return {
      abDirectory,
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

  async function importExisting(): Promise<"adopted" | "needs-provider"> {
    const abDirectory = get(location);
    const check = get(locationCheck);
    if (!abDirectory || check?.status !== "existing-ab") {
      throw new Error("importExisting called without an existing AB at the chosen location");
    }
    importMode.set(true);

    const settings = check.abSettings;
    const knownProvider = KNOWN_PROVIDERS.find((p) => p === settings?.provider);
    if (knownProvider && settings?.model) {
      provider.set(knownProvider);
      model.set(settings.model);
      await runSetupWith({
        abDirectory,
        provider: knownProvider,
        model: settings.model,
        language: get(language) ?? "es",
      });
      return "adopted";
    }

    step.set("provider");
    return "needs-provider";
  }

  function next(): void {
    if (!get(canProceed)) return;
    step.update(($step) => {
      const index = STEP_ORDER.indexOf($step);
      return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
    });
    if (get(step) === "model" && get(model) === undefined) {
      const id = get(provider);
      if (id) model.set(recommendedModelFor(id)?.id);
    }
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
    selectLanguage,
    setPersonalization,
    checkPrerequisites,
    loadDefaultLocation,
    pickLocation,
    selectProvider,
    submitApiKey,
    selectModel,
    next,
    beginCreating,
    finishSetup,
    importMode,
    importExisting,
    completed,
    setupError,
  };
}
