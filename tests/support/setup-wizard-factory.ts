import { createSetupController, type SetupController } from "../../src/lib/setup-controller";
import { makeSetupWorkerFake } from "./setup-worker-fake";
import type { SetupWorkerAPI } from "../../shared/api";

export interface WizardWorld {
  wizard?: SetupController;
}

export function wizardOf<T extends WizardWorld>(
  world: T,
  overrides: Partial<SetupWorkerAPI> | ((world: T) => Partial<SetupWorkerAPI>),
): SetupController {
  if (!world.wizard) {
    const resolved = typeof overrides === "function" ? overrides(world) : overrides;
    world.wizard = createSetupController(makeSetupWorkerFake(resolved));
  }
  return world.wizard;
}
