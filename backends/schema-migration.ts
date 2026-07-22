// backends/schema-migration.ts — ~/.buddy/ schema versioning (NFR-MIGRATE-01–05).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { APP_SCHEMA_VERSION } from "../shared/defaults";
import { migrate_0_to_1 } from "./migrations/migrate-0-to-1";

type MigrationFn = (configDir: string) => void;

const MIGRATIONS: MigrationFn[] = [migrate_0_to_1];

/** Global config directory (~/.buddy/). Overridable in tests via BUDDY_CONFIG_DIR. */
export function globalConfigDir(): string {
  return process.env.BUDDY_CONFIG_DIR ?? join(homedir(), ".buddy");
}

function versionPath(configDir: string): string {
  return join(configDir, "version");
}

/** Read installed schema version; absent or invalid file → 0. */
export function readSchemaVersion(configDir: string = globalConfigDir()): number {
  try {
    const raw = readFileSync(versionPath(configDir), "utf8").trim();
    const v = parseInt(raw, 10);
    return Number.isNaN(v) ? 0 : v;
  } catch {
    return 0;
  }
}

/** Run pending migrations and update ~/.buddy/version. Called once at worker boot. */
export function ensureSchema(configDir: string = globalConfigDir()): void {
  const current = readSchemaVersion(configDir);
  if (current >= APP_SCHEMA_VERSION) return;

  mkdirSync(configDir, { recursive: true });

  for (let v = current; v < APP_SCHEMA_VERSION; v++) {
    const migration = MIGRATIONS[v];
    if (!migration) {
      throw new Error(`Missing migration for schema ${v} → ${v + 1}`);
    }
    migration(configDir);
  }

  writeFileSync(versionPath(configDir), String(APP_SCHEMA_VERSION) + "\n", "utf8");
}
