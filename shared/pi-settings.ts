// shared/pi-settings.ts — Read/write project-scoped Pi settings (.pi/settings.json).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { SetupConfig } from "./api";
import { DEFAULT_PI_PROVIDER } from "./defaults";
import { toPiProviderId } from "./provider-mapping";

export interface PiSettings {
  defaultProvider?: string;
  defaultModel?: string;
}

export function piSettingsPath(abDirectory: string): string {
  return join(abDirectory, ".pi", "settings.json");
}

export function writePiSettings(abDirectory: string, config: Pick<SetupConfig, "provider" | "model">): void {
  const settingsPath = piSettingsPath(abDirectory);
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

export function readPiProvider(abDirectory: string): string {
  const settingsPath = piSettingsPath(abDirectory);
  if (!existsSync(settingsPath)) return DEFAULT_PI_PROVIDER;
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as PiSettings;
    return settings.defaultProvider ?? DEFAULT_PI_PROVIDER;
  } catch {
    return DEFAULT_PI_PROVIDER;
  }
}

export function readPiSettings(abDirectory: string): PiSettings | undefined {
  try {
    return JSON.parse(readFileSync(piSettingsPath(abDirectory), "utf8")) as PiSettings;
  } catch {
    return undefined;
  }
}
