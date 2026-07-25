// backends/boot-refresh.ts — Boot refresh on app semver change (NFR-MIGRATE-06).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { APP_VERSION } from "./app-version";
import { deployBundledGlobalContent } from "./deploy-bundled-content";

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
 * Deploy bundled ~/.buddy/ content when app semver changes (or on fresh install).
 * Single boot-time gate for prompts, docs, and future one-shot migrations.
 */
export function bootRefreshIfNeeded(
  configDir: string,
  appVersion: string = APP_VERSION,
): boolean {
  const configPath = join(configDir, "config.json");
  const config = readConfig(configPath);
  if (config.last_app_version === appVersion) return false;

  deployBundledGlobalContent(configDir);
  config.last_app_version = appVersion;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return true;
}

/** @deprecated Use bootRefreshIfNeeded — kept for incremental test migration. */
export const refreshPromptsIfNeeded = bootRefreshIfNeeded;
