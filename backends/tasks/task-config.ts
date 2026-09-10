// backends/tasks/task-config.ts — WIP limit in ~/.buddy/config.json (FR-TASK-04).

import { readFileSync } from "node:fs";

import { WIP_DEFAULT, type TaskConfig } from "../../shared/task-types";
import { globalConfigPath } from "../global-config";
import { readStateFile, writeStateFile } from "../state-file";

interface ConfigWithTasks {
  tasks?: { wipLimit?: number };
  [key: string]: unknown;
}

export function readTaskConfig(configPath: string = globalConfigPath()): TaskConfig {
  try {
    const data = readStateFile<ConfigWithTasks>(configPath) ?? {};
    const limit = data.tasks?.wipLimit;
    if (typeof limit === "number" && limit > 0) {
      return { wipLimit: limit };
    }
  } catch {
    try {
      const raw = readFileSync(configPath, "utf8");
      const data = JSON.parse(raw) as ConfigWithTasks;
      const limit = data.tasks?.wipLimit;
      if (typeof limit === "number" && limit > 0) {
        return { wipLimit: limit };
      }
    } catch {
      // unconfigured
    }
  }
  return { wipLimit: WIP_DEFAULT };
}

export function writeTaskWipLimit(
  wipLimit: number,
  configPath: string = globalConfigPath(),
): TaskConfig {
  let data: ConfigWithTasks = {};
  try {
    data = readStateFile<ConfigWithTasks>(configPath) ?? {};
  } catch {
    try {
      const raw = readFileSync(configPath, "utf8");
      data = JSON.parse(raw) as ConfigWithTasks;
    } catch {
      data = {};
    }
  }
  data.tasks = { ...data.tasks, wipLimit };
  writeStateFile(configPath, data);
  return { wipLimit };
}
