// tests/unit/config-dir-resolver.test.ts — NFR-CONFIG-05.
//
// Two resolvers answered "where does ~/.buddy live?": globalConfigDir() read
// BUDDY_CONFIG_DIR, globalConfigDir() took dirname(BUDDY_CONFIG_PATH). Setting
// one and not the other made them disagree, and they are consulted by different
// processes — the worker resolved usage.json one way, the reflect child (a
// separate process, FR-REFLECT-06) the other. A reflect run could then bill
// against a file the worker never read, so the budget cap silently undercounted.
//
// The first fix made the second name delegate to the first, and this file
// asserted they agreed. The names are now gone, so there is nothing left to
// disagree — what remains worth pinning is the precedence itself, which is what
// every caller depends on and what a "small" change to either variable would
// break.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dirname, join } from "node:path";

import { globalConfigDir, globalConfigPath } from "../../backends/global-config";
import { CONFIG_FILE_NAME } from "../../shared/defaults";

const VARS = ["BUDDY_CONFIG_DIR", "BUDDY_CONFIG_PATH", "AB_CONFIG_PATH"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(VARS.map((name) => [name, process.env[name]]));
  for (const name of VARS) delete process.env[name];
});

afterEach(() => {
  for (const name of VARS) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("the config directory has one resolver", () => {
  it("defaults to ~/.buddy, with config.json inside it", () => {
    expect(dirname(globalConfigPath())).toBe(globalConfigDir());
    expect(globalConfigPath()).toBe(join(globalConfigDir(), CONFIG_FILE_NAME));
  });

  it("honours BUDDY_CONFIG_DIR, moving every file that lives beside config.json", () => {
    process.env.BUDDY_CONFIG_DIR = "/somewhere/custom";

    expect(globalConfigDir()).toBe("/somewhere/custom");
    expect(globalConfigPath()).toBe(join("/somewhere/custom", CONFIG_FILE_NAME));
  });

  it("derives the directory from BUDDY_CONFIG_PATH when only that is set", () => {
    // The original divergence ran this way too: the directory resolver ignored
    // BUDDY_CONFIG_PATH, so usage.json and allowed-paths.json stayed in
    // ~/.buddy while config.json moved.
    process.env.BUDDY_CONFIG_PATH = "/elsewhere/app/settings.json";

    expect(globalConfigDir()).toBe("/elsewhere/app");
    expect(globalConfigPath()).toBe("/elsewhere/app/settings.json");
  });

  it("lets BUDDY_CONFIG_DIR win for the directory when both are set", () => {
    process.env.BUDDY_CONFIG_DIR = "/dir/wins";
    process.env.BUDDY_CONFIG_PATH = "/other/place/config.json";

    expect(globalConfigDir()).toBe("/dir/wins");
    // The config file itself still honours its own variable — it may name a
    // basename that is not config.json.
    expect(globalConfigPath()).toBe("/other/place/config.json");
  });

  it("honours the legacy config path variable", () => {
    process.env.AB_CONFIG_PATH = "/legacy/home/config.json";

    expect(globalConfigDir()).toBe("/legacy/home");
    expect(globalConfigPath()).toBe("/legacy/home/config.json");
  });
});
