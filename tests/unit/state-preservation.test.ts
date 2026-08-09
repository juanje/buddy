// tests/unit/state-preservation.test.ts — NFR-REL-08 applied to real callers.
//
// The module-level guarantees are covered in state-file.test.ts. What is checked
// here is that each state writer actually uses them, because the defect was
// never in a helper — it was four callers each deciding that "cannot read" meant
// "empty" and writing over the file.
//
// Every case below destroyed user data before H5.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { addAllowedPath, loadAllowedPaths } from "../../backends/allowed-paths";
import { bootRefreshIfNeeded } from "../../backends/boot-refresh";
import { configureProviderKey } from "../../backends/provider-auth";
import { recordUsageToFile } from "../../backends/usage-tracker";
import { StateFileUnreadableError } from "../../backends/state-file";

let dir: string;
const CORRUPT = "{ this is not json";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "state-preservation-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("auth.json", () => {
  const authPath = () => join(dir, "auth.json");

  it("keeps previously configured providers when adding one", async () => {
    await configureProviderKey("anthropic", "sk-ant", {
      authPath: authPath(),
      probe: async () => ({ ok: true }),
    });
    await configureProviderKey("openai", "sk-openai", {
      authPath: authPath(),
      probe: async () => ({ ok: true }),
    });

    const store = JSON.parse(readFileSync(authPath(), "utf8")) as Record<string, unknown>;
    expect(Object.keys(store).sort()).toEqual(["anthropic", "openai-codex"]);
  });

  it("refuses to store into an unreadable file instead of replacing it", async () => {
    writeFileSync(authPath(), CORRUPT);
    await expect(
      configureProviderKey("openai", "sk-new", {
        authPath: authPath(),
        probe: async () => ({ ok: true }),
      }),
    ).rejects.toThrow(StateFileUnreadableError);
    // Recoverable by hand rather than silently gone.
    expect(readFileSync(authPath(), "utf8")).toBe(CORRUPT);
  });

  it("writes the credential file with restrictive permissions", async () => {
    await configureProviderKey("anthropic", "sk-ant", {
      authPath: authPath(),
      probe: async () => ({ ok: true }),
    });
    const { existsSync, statSync } = await import("node:fs");
    if (process.platform !== "win32") {
      expect(statSync(authPath()).mode & 0o777).toBe(0o600);
    } else {
      expect(existsSync(authPath())).toBe(true);
    }
  });
});

describe("allowed-paths.json", () => {
  it("keeps previously approved paths when adding one", () => {
    // On Windows, absolute Unix-looking paths resolve under the drive root
    // (e.g. `/tmp/one` → `D:\tmp\one`). Compare against the resolved form.
    const one = resolve("/tmp/one");
    const two = resolve("/tmp/two");
    addAllowedPath(dir, { path: "/tmp/one", type: "directory" });
    addAllowedPath(dir, { path: "/tmp/two", type: "file" });
    expect(loadAllowedPaths(dir).map((e) => e.path).sort()).toEqual([one, two].sort());
  });

  it("refuses to add into an unreadable file instead of wiping approvals", () => {
    writeFileSync(join(dir, "allowed-paths.json"), CORRUPT);
    expect(() => addAllowedPath(dir, { path: "/tmp/new", type: "file" })).toThrow(
      StateFileUnreadableError,
    );
    expect(readFileSync(join(dir, "allowed-paths.json"), "utf8")).toBe(CORRUPT);
  });
});

describe("usage.json", () => {
  it("accumulates across calls", () => {
    const now = new Date("2026-07-27T12:00:00Z");
    recordUsageToFile(dir, { cost: 0.01, tokens: 5 }, now);
    const total = recordUsageToFile(dir, { cost: 0.02, tokens: 7 }, now);
    expect(total.messageCount).toBe(2);
    expect(total.totalTokens).toBe(12);
  });

  it("refuses to merge into an unreadable file", () => {
    writeFileSync(join(dir, "usage.json"), CORRUPT);
    expect(() => recordUsageToFile(dir, { cost: 0.01, tokens: 1 })).toThrow(
      StateFileUnreadableError,
    );
  });
});

describe("config.json via boot refresh", () => {
  it("preserves the rest of the config when recording the version", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({ rootDir: "/home/u/buddy", provider: "anthropic", monthlyBudget: 25 }),
    );

    bootRefreshIfNeeded(dir, "9.9.9");

    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(config.rootDir).toBe("/home/u/buddy");
    expect(config.provider).toBe("anthropic");
    expect(config.monthlyBudget).toBe(25);
    expect(config.last_app_version).toBe("9.9.9");
  });

  it("leaves an unreadable config untouched rather than resetting the install", () => {
    // The worst instance of the pattern: overwriting here discards the rootDir
    // pointer, and the user is returned to the setup wizard with no recovery.
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, CORRUPT);

    expect(() => bootRefreshIfNeeded(dir, "9.9.9")).not.toThrow();
    expect(readFileSync(configPath, "utf8")).toBe(CORRUPT);
  });
});
