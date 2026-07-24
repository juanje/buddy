// backends/prompt-refresh.ts — Prompt refresh on app semver change (NFR-MIGRATE-06).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { APP_VERSION } from "../shared/defaults";
import { migrate_0_to_1 } from "./migrations/migrate-0-to-1";

interface BuddyConfigRecord {
  last_app_version?: string;
  [key: string]: unknown;
}

function readConfig(configPath: string): BuddyConfigRecord {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as BuddyConfigRecord;
  } catch {
    return {};
  }
}

/**
 * Overwrite ~/.buddy/prompts/ from bundled prompts when app semver changes.
 * Orthogonal to integer schema migrations (NFR-MIGRATE-01..05).
 */
export function refreshPromptsIfNeeded(
  configDir: string,
  appVersion: string = APP_VERSION,
): boolean {
  const configPath = join(configDir, "config.json");
  const config = readConfig(configPath);
  if (config.last_app_version === appVersion) return false;

  migrate_0_to_1(configDir);
  config.last_app_version = appVersion;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  return true;
}
