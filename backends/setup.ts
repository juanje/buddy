// backends/setup.ts — First-run detection (FR-SETUP-01).
// The app is "configured" when ~/.ab-app/config.json exists, parses, and
// names a non-empty AB directory. Anything else (missing file, corrupted
// JSON, missing key) is a first run: the wizard owns recovery, so detection
// never throws.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { SetupConfig, SetupState } from "../shared/api";

/** Default location of the app config; overridable for dev/tests via env. */
export function defaultConfigPath(): string {
  return process.env.AB_CONFIG_PATH ?? join(homedir(), ".ab-app", "config.json");
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
    if (typeof parsed.abDirectory === "string" && parsed.abDirectory.trim() !== "") {
      return { firstRun: false, config: parsed as SetupConfig };
    }
  } catch {
    // Corrupted config: treat as unconfigured; the wizard will rewrite it.
  }
  return { firstRun: true };
}
