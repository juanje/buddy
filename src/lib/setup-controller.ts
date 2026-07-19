// src/lib/setup-controller.ts — framework-agnostic setup wizard logic.
// The SetupWizard component is a thin view over these stores, mirroring the
// chat-controller pattern. Built out feature by feature:
//   FR-SETUP-02 prerequisites gate
//   FR-SETUP-03 location picker (+ FR-SETUP-08 import detection)
//   FR-SETUP-04 provider + API key
//   FR-SETUP-05 model selection (curated catalog, recommended default)

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

export type SetupStep = "prerequisites" | "location" | "provider" | "model" | "creating";

export interface SetupController {
  /** Current wizard step. */
  step: Readable<SetupStep>;
  /** Last prerequisites report (undefined until the first check completes). */
  prereq: Readable<PrereqStatus | undefined>;
  /** True while a prerequisites check is in flight. */
  checking: Readable<boolean>;
  /** Chosen AB location (prefilled with the worker's default). */
  location: Readable<string | undefined>;
  /** Validation verdict for the chosen location. */
  locationCheck: Readable<LocationCheck | undefined>;
  /** Selected AI provider (FR-SETUP-04). */
  provider: Readable<ProviderId | undefined>;
  /** Whether the selected provider needs a base URL (OpenAI-compatible). */
  needsBaseUrl: Readable<boolean>;
  /** Verdict of the last API key submission. */
  keyCheck: Readable<KeyCheck | undefined>;
  /** True while a key validation is in flight. */
  validatingKey: Readable<boolean>;
  /** Chosen model id (preselected with the provider's recommended model). */
  model: Readable<string | undefined>;
  /** Whether the current step's requirements are met. */
  canProceed: Readable<boolean>;

  /** Run (or re-run) the prerequisites check. */
  checkPrerequisites(): Promise<void>;
  /** Prefill the location input with the worker's proposed default. */
  loadDefaultLocation(): Promise<string>;
  /** Validate and store a candidate AB location (FR-SETUP-03). */
  pickLocation(path: string): Promise<void>;
  /** Choose the AI provider; resets any previous key verdict (FR-SETUP-04). */
  selectProvider(provider: ProviderId): void;
  /** Validate the key against the provider and store it on success. */
  submitApiKey(apiKey: string, baseUrl?: string): Promise<void>;
  /** Choose the model to use (FR-SETUP-05). */
  selectModel(modelId: string): void;
  /** Advance to the next step (no-op if canProceed is false). */
  next(): void;
  /**
   * Run deterministic AB creation with the collected answers (FR-SETUP-06).
   * Resolves when the AB exists and the session is live; rejects on failure.
   */
  finishSetup(): Promise<void>;
  /** True when adopting an existing AB instead of creating one (FR-SETUP-08). */
  importMode: Readable<boolean>;
  /**
   * Adopt the existing AB at the chosen location (FR-SETUP-08). Returns
   * "adopted" when its own settings sufficed, or "needs-provider" when the
   * wizard must continue through the provider/model steps in import mode.
   */
  importExisting(): Promise<"adopted" | "needs-provider">;
  /** True once setup completed successfully (the app can enter the chat). */
  completed: Readable<boolean>;
  /** Error message if AB creation failed. */
  setupError: Readable<string | undefined>;
}

const STEP_ORDER: SetupStep[] = ["prerequisites", "location", "provider", "model", "creating"];

const USABLE_LOCATION: ReadonlyArray<LocationCheck["status"]> = ["ok-new", "ok-empty"];

export function createSetupController(worker: SetupWorkerAPI): SetupController {
  const step = writable<SetupStep>("prerequisites");
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
    [step, prereq, locationCheck, keyCheck, model],
    ([$step, $prereq, $locationCheck, $keyCheck, $model]) => {
      switch ($step) {
        case "prerequisites":
          return $prereq?.gitInstalled === true;
        case "location":
          return $locationCheck !== undefined && USABLE_LOCATION.includes($locationCheck.status);
        case "provider":
          return $keyCheck?.valid === true;
        case "model":
          return typeof $model === "string" && $model.trim() !== "";
        default:
          // Later steps define their own gates as they are implemented.
          return false;
      }
    },
  );

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
    keyCheck.set(undefined); // a new provider invalidates any previous verdict
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

  async function runSetupWith(config: {
    abDirectory: string;
    provider: ProviderId;
    model: string;
  }): Promise<void> {
    step.set("creating");
    setupError.set(undefined);
    try {
      await worker.runSetup(config, get(importMode) ? "import" : "create");
      completed.set(true);
    } catch (err) {
      setupError.set(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async function finishSetup(): Promise<void> {
    const abDirectory = get(location);
    const providerId = get(provider);
    const modelId = get(model);
    if (!abDirectory || !providerId || !modelId) {
      throw new Error("finishSetup called before the wizard collected all answers");
    }
    await runSetupWith({ abDirectory, provider: providerId, model: modelId });
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
      await runSetupWith({ abDirectory, provider: knownProvider, model: settings.model });
      return "adopted";
    }

    // Missing or unrecognized settings: collect provider/model in the wizard;
    // finishSetup will then adopt (import mode) instead of creating.
    step.set("provider");
    return "needs-provider";
  }

  function next(): void {
    if (!get(canProceed)) return;
    step.update(($step) => {
      const index = STEP_ORDER.indexOf($step);
      return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
    });
    // Entering the model step preselects the provider's recommended model
    // (FR-SETUP-05); "custom" has no catalog, so the user must type an id.
    if (get(step) === "model" && get(model) === undefined) {
      const id = get(provider);
      if (id) model.set(recommendedModelFor(id)?.id);
    }
  }

  return {
    step,
    prereq,
    checking,
    location,
    locationCheck,
    provider,
    needsBaseUrl,
    keyCheck,
    validatingKey,
    model,
    canProceed,
    checkPrerequisites,
    loadDefaultLocation,
    pickLocation,
    selectProvider,
    submitApiKey,
    selectModel,
    next,
    finishSetup,
    importMode,
    importExisting,
    completed,
    setupError,
  };
}
