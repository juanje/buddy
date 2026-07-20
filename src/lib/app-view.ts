// src/lib/app-view.ts — top-level view routing (FR-SETUP-01).
// Kept as a pure function so BDD steps exercise the same decision the
// App component renders.

import type { SetupState } from "../../shared/api";
import { setLocale } from "./i18n";

export type AppView = "setup" | "chat";

export function resolveInitialView(state: SetupState): AppView {
  return state.firstRun ? "setup" : "chat";
}

/** Sync UI locale from persisted config (NFR-I18N). */
export function applyLocaleFromSetup(state: SetupState): void {
  if (state.firstRun) return;
  setLocale(state.config.language ?? "es");
}
