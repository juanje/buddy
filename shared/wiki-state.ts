// shared/wiki-state.ts — Wiki maintenance cycle state (FR-WIKI-05/06).

/** @backend-only — imports node:fs, node:path; not browser-safe. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { WIKI_STATE_PATH } from "./defaults";

export interface WikiMaintenanceState {
  lastHealthCheck: string | null;
  pagesAtLastCheck: number;
  lastSynthesis: string | null;
  pagesAtLastSynthesis: number;
  synthesisCooldownDays: number;
}

export const DEFAULT_SYNTHESIS_COOLDOWN_DAYS = 7;

export function defaultWikiState(): WikiMaintenanceState {
  return {
    lastHealthCheck: null,
    pagesAtLastCheck: 0,
    lastSynthesis: null,
    pagesAtLastSynthesis: 0,
    synthesisCooldownDays: DEFAULT_SYNTHESIS_COOLDOWN_DAYS,
  };
}

function stateFilePath(rootDir: string): string {
  return join(rootDir, WIKI_STATE_PATH);
}

export function loadWikiState(rootDir: string): WikiMaintenanceState {
  const path = stateFilePath(rootDir);
  if (!existsSync(path)) return defaultWikiState();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<WikiMaintenanceState>;
    return { ...defaultWikiState(), ...parsed };
  } catch {
    return defaultWikiState();
  }
}

export function saveWikiState(rootDir: string, state: WikiMaintenanceState): void {
  const path = stateFilePath(rootDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}
