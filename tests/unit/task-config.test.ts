// tests/unit/task-config.test.ts — FR-TASKM-46 WIP override config.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readTaskConfig,
  writeTaskWipLimit,
  writeTaskWipOverrides,
} from "../../backends/tasks/task-config";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

describe("task-config WIP overrides", () => {
  let configDir: string | undefined;

  beforeEach(() => {
    ({ configDir } = setupGlobalConfigDir());
  });

  afterEach(() => {
    teardownGlobalConfigDir(configDir);
  });

  it("read with no overrides omits wipLimitOverrides", () => {
    const config = readTaskConfig();
    expect(config.wipLimit).toBe(3);
    expect(config.wipLimitOverrides).toBeUndefined();
  });

  it("write and read overrides round-trip", () => {
    writeTaskWipOverrides({ work: null, personal: 5 });
    const config = readTaskConfig();
    expect(config.wipLimitOverrides).toEqual({ work: null, personal: 5 });
  });

  it("merges overrides instead of replacing", () => {
    writeTaskWipOverrides({ work: null });
    writeTaskWipOverrides({ personal: 5 });
    const config = readTaskConfig();
    expect(config.wipLimitOverrides).toEqual({ work: null, personal: 5 });
  });

  it("override writes do not change global wipLimit", () => {
    writeTaskWipLimit(7);
    writeTaskWipOverrides({ work: null });
    const config = readTaskConfig();
    expect(config.wipLimit).toBe(7);
    const raw = JSON.parse(readFileSync(`${configDir}/config.json`, "utf8")) as {
      tasks?: { wipLimit?: number };
    };
    expect(raw.tasks?.wipLimit).toBe(7);
  });
});
