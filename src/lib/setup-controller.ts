// src/lib/setup-controller.ts — framework-agnostic setup wizard logic.
// The SetupWizard component is a thin view over these stores, mirroring the
// chat-controller pattern. Built out feature by feature:
//   FR-SETUP-02 prerequisites gate
//   (FR-SETUP-03 location, 04 provider, 05 model arrive next)

import { derived, writable, type Readable } from "svelte/store";
import type { PrereqStatus, SetupWorkerAPI } from "../../shared/api";

export type SetupStep = "prerequisites" | "location" | "provider" | "model" | "creating";

export interface SetupController {
  /** Current wizard step. */
  step: Readable<SetupStep>;
  /** Last prerequisites report (undefined until the first check completes). */
  prereq: Readable<PrereqStatus | undefined>;
  /** True while a prerequisites check is in flight. */
  checking: Readable<boolean>;
  /** Whether the current step's requirements are met (FR-SETUP-02: git). */
  canProceed: Readable<boolean>;

  /** Run (or re-run) the prerequisites check. */
  checkPrerequisites(): Promise<void>;
  /** Advance to the next step (no-op if canProceed is false). */
  next(): void;
}

const STEP_ORDER: SetupStep[] = ["prerequisites", "location", "provider", "model", "creating"];

export function createSetupController(worker: SetupWorkerAPI): SetupController {
  const step = writable<SetupStep>("prerequisites");
  const prereq = writable<PrereqStatus | undefined>(undefined);
  const checking = writable(false);

  const canProceed = derived([step, prereq], ([$step, $prereq]) => {
    if ($step === "prerequisites") return $prereq?.gitInstalled === true;
    // Later steps define their own gates as they are implemented.
    return false;
  });

  async function checkPrerequisites(): Promise<void> {
    checking.set(true);
    try {
      prereq.set(await worker.checkPrerequisites());
    } finally {
      checking.set(false);
    }
  }

  function next(): void {
    let proceed = false;
    canProceed.subscribe((v) => (proceed = v))();
    if (!proceed) return;
    step.update(($step) => {
      const index = STEP_ORDER.indexOf($step);
      return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
    });
  }

  return { step, prereq, checking, canProceed, checkPrerequisites, next };
}
