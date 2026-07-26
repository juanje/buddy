// shared/pi-settings.ts — Read/write project-scoped Pi settings (.pi/settings.json).

/** @backend-only — imports node:fs, node:path; not browser-safe. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { SetupConfig } from "./api";
import { DEFAULT_PI_PROVIDER } from "./defaults";
import { toPiProviderId } from "./provider-mapping";

export interface PiSettings {
  defaultProvider?: string;
  defaultModel?: string;
}

export function piSettingsPath(rootDir: string): string {
  return join(rootDir, ".pi", "settings.json");
}

export function writePiSettings(rootDir: string, config: Pick<SetupConfig, "provider" | "model">): void {
  const settingsPath = piSettingsPath(rootDir);
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(
    settingsPath,
    JSON.stringify(
      { defaultProvider: toPiProviderId(config.provider), defaultModel: config.model },
      null,
      2,
    ) + "\n",
  );
}

export function readPiProvider(rootDir: string): string {
  const settingsPath = piSettingsPath(rootDir);
  if (!existsSync(settingsPath)) return DEFAULT_PI_PROVIDER;
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as PiSettings;
    return settings.defaultProvider ?? DEFAULT_PI_PROVIDER;
  } catch {
    return DEFAULT_PI_PROVIDER;
  }
}

export function readPiSettings(rootDir: string): PiSettings | undefined {
  try {
    return JSON.parse(readFileSync(piSettingsPath(rootDir), "utf8")) as PiSettings;
  } catch {
    return undefined;
  }
}
