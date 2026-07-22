// backends/setup.ts — First-run detection (FR-SETUP-01).
// The app is "configured" when ~/.buddy/config.json exists, parses, and
// names a non-empty AB directory. Anything else (missing file, corrupted
// JSON, missing key) is a first run: the wizard owns recovery, so detection
// never throws.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { SetupConfig, SetupState } from "../shared/api";

/** Default location of the app config; overridable for dev/tests via env. */
export function defaultConfigPath(): string {
  return process.env.BUDDY_CONFIG_PATH ?? process.env.AB_CONFIG_PATH ?? join(homedir(), ".buddy", "config.json");
}

export function detectFirstRun(configPath: string): SetupState {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return { firstRun: true };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SetupConfig>;
    if (typeof parsed.rootDir === "string" && parsed.rootDir.trim() !== "") {
      return { firstRun: false, config: parsed as SetupConfig };
    }
  } catch {
    // Corrupted config: treat as unconfigured; the wizard will rewrite it.
  }
  return { firstRun: true };
}

/** Persist partial updates to ~/.buddy/config.json (FR-SETTINGS-02). */
export function updateAppConfig(
  patch: Partial<Pick<SetupConfig, "language" | "model" | "provider">>,
  configPath: string = defaultConfigPath(),
): SetupConfig {
  const state = detectFirstRun(configPath);
  if (state.firstRun) {
    throw new Error("App is not configured");
  }
  const updated: SetupConfig = { ...state.config, ...patch };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n");
  return updated;
}
