// backends/tasks/task-config.ts — WIP limit in ~/.buddy/config.json (FR-TASK-04, FR-TASKM-46).

import { readFileSync } from "node:fs";

import { WIP_DEFAULT, type TaskConfig } from "../../shared/task-types";
import { globalConfigPath } from "../global-config";
import { readStateFile, writeStateFile } from "../state-file";

interface ConfigWithTasks {
  tasks?: {
    wipLimit?: number;
    wipLimitOverrides?: Record<string, number | null>;
  };
  [key: string]: unknown;
}

function readConfigRaw(configPath: string): ConfigWithTasks {
  try {
    return readStateFile<ConfigWithTasks>(configPath) ?? {};
  } catch {
    try {
      const raw = readFileSync(configPath, "utf8");
      return JSON.parse(raw) as ConfigWithTasks;
    } catch {
      return {};
    }
  }
}

function resolveWipLimit(data: ConfigWithTasks): number {
  const limit = data.tasks?.wipLimit;
  if (typeof limit === "number" && limit > 0) {
    return limit;
  }
  return WIP_DEFAULT;
}

export function readTaskConfig(configPath: string = globalConfigPath()): TaskConfig {
  const data = readConfigRaw(configPath);
  const config: TaskConfig = { wipLimit: resolveWipLimit(data) };
  const overrides = data.tasks?.wipLimitOverrides;
  if (overrides !== undefined) {
    config.wipLimitOverrides = overrides;
  }
  return config;
}

export function writeTaskWipLimit(
  wipLimit: number,
  configPath: string = globalConfigPath(),
): TaskConfig {
  const data = readConfigRaw(configPath);
  data.tasks = { ...data.tasks, wipLimit };
  writeStateFile(configPath, data);
  const config: TaskConfig = { wipLimit };
  if (data.tasks?.wipLimitOverrides !== undefined) {
    config.wipLimitOverrides = data.tasks.wipLimitOverrides;
  }
  return config;
}

export function writeTaskWipOverrides(
  overrides: Record<string, number | null>,
  configPath: string = globalConfigPath(),
): TaskConfig {
  const data = readConfigRaw(configPath);
  const merged = { ...(data.tasks?.wipLimitOverrides ?? {}), ...overrides };
  data.tasks = { ...data.tasks, wipLimitOverrides: merged };
  writeStateFile(configPath, data);
  return readTaskConfig(configPath);
}
