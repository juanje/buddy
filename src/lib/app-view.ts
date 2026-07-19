// src/lib/app-view.ts — top-level view routing (FR-SETUP-01).
// Kept as a pure function so BDD steps exercise the same decision the
// App component renders.

import type { SetupState } from "../../shared/api";

export type AppView = "setup" | "chat";

export function resolveInitialView(state: SetupState): AppView {
  return state.firstRun ? "setup" : "chat";
}
