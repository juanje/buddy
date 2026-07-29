// backends/global-config.ts — ~/.buddy/ global config directory paths.

import { chmodSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  CONFIG_DIR_MODE,
  CONFIG_FILE_NAME,
  GLOBAL_CONFIG_DIR_NAME,
  LEGACY_CONFIG_PATH_ENV,
} from "../shared/defaults";

/**
 * The one resolver for the global config directory (NFR-CONFIG-05).
 *
 * There used to be two. `globalConfigDir()` read `BUDDY_CONFIG_DIR`;
 * `defaultConfigDir()` in allowed-paths.ts took `dirname(defaultConfigPath())`,
 * derived from `BUDDY_CONFIG_PATH`. Setting one variable and not the other made
 * them disagree — and they are not consulted by the same processes. The worker
 * resolved `usage.json` one way while the reflect child, a separate process,
 * resolved it the other, so a run could bill against a file nobody was reading.
 * Both variables are still honoured, but through a single precedence:
 *
 * Both alias names (`defaultConfigDir`, `defaultConfigPath`) were removed on
 * 2026-07-29: making the second name delegate left the condition that caused
 * the divergence — two names for one answer — and a test can only pin the
 * agreement of the names it knows about.
 *
 *   1. BUDDY_CONFIG_DIR — names the directory outright.
 *   2. The directory of BUDDY_CONFIG_PATH (or its legacy alias), so setting
 *      only the config file still moves everything that lives beside it.
 *   3. ~/.buddy
 */
export function globalConfigDir(): string {
  const explicitDir = process.env.BUDDY_CONFIG_DIR;
  if (explicitDir) return explicitDir;

  const configPath = process.env.BUDDY_CONFIG_PATH ?? process.env[LEGACY_CONFIG_PATH_ENV];
  if (configPath) return dirname(configPath);

  return join(homedir(), GLOBAL_CONFIG_DIR_NAME);
}

/**
 * Default location of ~/.buddy/config.json. `BUDDY_CONFIG_PATH` may name a file
 * whose basename is not config.json (tests do), so it wins outright here; every
 * other file under the directory is placed by `globalConfigDir()`.
 */
export function globalConfigPath(): string {
  return (
    process.env.BUDDY_CONFIG_PATH ??
    process.env[LEGACY_CONFIG_PATH_ENV] ??
    join(globalConfigDir(), CONFIG_FILE_NAME)
  );
}

/**
 * Buddy's own Pi agent directory (NFR-SEC-19).
 *
 * The SDK's `getAgentDir()` returns `~/.pi/agent` — the user's Pi CLI setup.
 * That directory governs far more than credentials: skills, `settings.json`,
 * `tools/`, `extensions/`, `prompts/`, the project trust store and
 * `models.json`. Passing it meant NFR-AUTH-ISO isolated the credentials and
 * nothing else, so every Buddy session inherited whatever the user had
 * installed for a different tool.
 *
 * Observed in practice: a globally installed `wiki-kb` skill was advertised to
 * the agent, which tried to read it from `~/.pi/` — raising a Zone 3 permission
 * prompt for a file outside the workspace — only to find instructions requiring
 * bash, which Buddy does not have. Three layers of confusing failure, and a
 * permission prompt the user had no basis to judge.
 *
 * An empty directory yields no skills and no diagnostics, which is the intended
 * baseline; Buddy's own capabilities are registered as custom tools instead.
 */
export function buddyAgentDir(): string {
  const dir = join(globalConfigDir(), "agent");
  mkdirSync(dir, { recursive: true, mode: CONFIG_DIR_MODE }); // NFR-SEC-17
  return dir;
}

/**
 * Buddy's own model definitions (NFR-SEC-19).
 *
 * `ModelRuntime.create` defaults `modelsPath` to `join(getAgentDir(),
 * "models.json")` — the Pi CLI's. Omitting it meant Buddy loaded the user's
 * personal provider definitions as if they were its own; verified on a real
 * install, where Buddy reported the user's `ollama` and `omlx` providers.
 *
 * The file need not exist. It is also where FR-PROVIDER-01 will write custom
 * endpoints, which is why it lives beside `auth.json` rather than inside
 * `agentDir` — that directory stays empty by design.
 */
export function buddyModelsPath(): string {
  return join(globalConfigDir(), "models.json");
}

/**
 * Where the SDK caches refreshed model catalogues (NFR-SEC-19).
 *
 * Defaults to `dirname(modelsPath)`, so leaving it unset put Buddy's cache
 * inside the user's `~/.pi/agent/` — a write into another tool's directory,
 * not just a read from it.
 */
export function buddyModelsStorePath(): string {
  return join(globalConfigDir(), "models-store.json");
}

/**
 * Create ~/.buddy/ (if absent) and narrow it if it is more permissive than
 * `CONFIG_DIR_MODE` (NFR-SEC-17).
 *
 * New installs get the right mode at creation, which is the requirement. This
 * exists for the ones that already have the directory at the umask default —
 * they would otherwise keep a world-readable allowed-paths.json forever, since
 * nothing rewrites a directory's mode once it exists. Called once at worker
 * boot, and deliberately best-effort: a config directory that cannot be
 * chmod-ed (a mounted volume, an unusual filesystem) is not a reason to refuse
 * to start.
 */
export function ensureConfigDirMode(dir: string = globalConfigDir()): void {
  try {
    mkdirSync(dir, { recursive: true, mode: CONFIG_DIR_MODE });
    const current = statSync(dir).mode & 0o777;
    if ((current & ~CONFIG_DIR_MODE) !== 0) chmodSync(dir, CONFIG_DIR_MODE);
  } catch {
    // Best effort; the files inside are written 0600 regardless.
  }
}
