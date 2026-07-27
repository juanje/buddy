// backends/boot-refresh.ts — Boot refresh on app semver change (NFR-MIGRATE-06).

import { join } from "node:path";

import { APP_VERSION } from "./app-version";
import { deployBundledGlobalContent } from "./deploy-bundled-content";
import { CONFIG_FILE_NAME } from "../shared/defaults";
import { readStateFile, updateStateFile, StateFileUnreadableError } from "./state-file";

interface BuddyConfigRecord {
  last_app_version?: string;
  [key: string]: unknown;
}

/**
 * Deploy bundled ~/.buddy/ content when app semver changes (or on fresh install).
 * Single boot-time gate for prompts, docs, and future one-shot migrations.
 *
 * NFR-REL-08: an unreadable config is left untouched. The previous version
 * treated any read failure as an empty config and then wrote `{last_app_version}`
 * over it — discarding the rootDir pointer, provider, model, language and
 * budget. A transient read error was enough to send a fully configured user
 * back to the setup wizard with no way to recover what was there.
 */
export function bootRefreshIfNeeded(
  configDir: string,
  appVersion: string = APP_VERSION,
): boolean {
  const configPath = join(configDir, CONFIG_FILE_NAME);

  let current: BuddyConfigRecord | undefined;
  try {
    current = readStateFile<BuddyConfigRecord>(configPath);
  } catch (error) {
    if (!(error instanceof StateFileUnreadableError)) throw error;
    // Deploying bundled content is idempotent and safe, so still do it; but do
    // not record the version, because that would mean rewriting the file we
    // could not read.
    console.error(`[boot-refresh] config unreadable, leaving it untouched: ${configPath}`);
    deployBundledGlobalContent(configDir);
    return true;
  }

  if (current?.last_app_version === appVersion) return false;

  deployBundledGlobalContent(configDir);
  updateStateFile<BuddyConfigRecord>(configPath, (config) => ({
    ...(config ?? {}),
    last_app_version: appVersion,
  }));
  return true;
}
