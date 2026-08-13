// backends/boot-refresh.ts — Boot refresh on app semver change (NFR-MIGRATE-06).

import { join } from "node:path";

import { APP_VERSION } from "./app-version";
import { deployBundledDocs, deployBundledPrompts } from "./deploy-bundled-content";
import { CONFIG_FILE_NAME } from "../shared/defaults";
import { readStateFile, updateStateFile, StateFileUnreadableError } from "./state-file";

interface BuddyConfigRecord {
  last_app_version?: string;
  [key: string]: unknown;
}

/**
 * Check whether a boot refresh is due. Returns true when the app version
 * changed (or the config is unreadable). Does NOT deploy docs — that can
 * wait until after the RPC channel is up. Prompts are deployed here because
 * the session needs them for system prompt assembly.
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
    console.error(`[boot-refresh] config unreadable, leaving it untouched: ${configPath}`);
    deployBundledPrompts(configDir);
    return true;
  }

  if (current?.last_app_version === appVersion) return false;

  deployBundledPrompts(configDir);
  updateStateFile<BuddyConfigRecord>(configPath, (config) => ({
    ...(config ?? {}),
    last_app_version: appVersion,
  }));
  return true;
}

/**
 * Deploy docs separately — safe to call after the RPC channel is up.
 * Only runs when `bootRefreshIfNeeded` returned true (version changed).
 */
export function bootDeployDocs(configDir: string): void {
  deployBundledDocs(configDir);
}
