// src/lib/setup-controller.ts — framework-agnostic setup wizard logic.
// The SetupWizard component is a thin view over these stores, mirroring the
// chat-controller pattern. Built out feature by feature:
//   FR-SETUP-02 prerequisites gate
//   FR-SETUP-03 location picker (+ FR-SETUP-08 import detection)
//   (FR-SETUP-04 provider, 05 model arrive next)

import { derived, get, writable, type Readable } from "svelte/store";
import type { LocationCheck, PrereqStatus, SetupWorkerAPI } from "../../shared/api";

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
  /** Whether the current step's requirements are met. */
  canProceed: Readable<boolean>;

  /** Run (or re-run) the prerequisites check. */
  checkPrerequisites(): Promise<void>;
  /** Prefill the location input with the worker's proposed default. */
  loadDefaultLocation(): Promise<string>;
  /** Validate and store a candidate AB location (FR-SETUP-03). */
  pickLocation(path: string): Promise<void>;
  /** Advance to the next step (no-op if canProceed is false). */
  next(): void;
}

const STEP_ORDER: SetupStep[] = ["prerequisites", "location", "provider", "model", "creating"];

const USABLE_LOCATION: ReadonlyArray<LocationCheck["status"]> = ["ok-new", "ok-empty"];

export function createSetupController(worker: SetupWorkerAPI): SetupController {
  const step = writable<SetupStep>("prerequisites");
  const prereq = writable<PrereqStatus | undefined>(undefined);
  const checking = writable(false);
  const location = writable<string | undefined>(undefined);
  const locationCheck = writable<LocationCheck | undefined>(undefined);

  const canProceed = derived(
    [step, prereq, locationCheck],
    ([$step, $prereq, $locationCheck]) => {
      switch ($step) {
        case "prerequisites":
          return $prereq?.gitInstalled === true;
        case "location":
          return $locationCheck !== undefined && USABLE_LOCATION.includes($locationCheck.status);
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

  function next(): void {
    if (!get(canProceed)) return;
    step.update(($step) => {
      const index = STEP_ORDER.indexOf($step);
      return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
    });
  }

  return {
    step,
    prereq,
    checking,
    location,
    locationCheck,
    canProceed,
    checkPrerequisites,
    loadDefaultLocation,
    pickLocation,
    next,
  };
}
