// backends/orientation-config.ts — last orientation date in ~/.buddy/config.json (FR-ORIENT-02).

import { globalConfigPath } from "./global-config";
import { readStateFile, writeStateFile } from "./state-file";

interface ConfigWithOrientation {
  orientation?: { lastShownDate?: string };
  [key: string]: unknown;
}

export function readLastOrientationDate(configPath: string = globalConfigPath()): string | null {
  try {
    const data = readStateFile<ConfigWithOrientation>(configPath) ?? {};
    const date = data.orientation?.lastShownDate;
    return typeof date === "string" && date.trim() !== "" ? date : null;
  } catch {
    return null;
  }
}

export function writeLastOrientationDate(date: string, configPath: string = globalConfigPath()): void {
  let data: ConfigWithOrientation = {};
  try {
    data = readStateFile<ConfigWithOrientation>(configPath) ?? {};
  } catch {
    data = {};
  }
  data.orientation = { ...data.orientation, lastShownDate: date };
  writeStateFile(configPath, data);
}
