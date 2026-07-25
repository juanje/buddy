// tests/unit/boot-refresh.test.ts — NFR-MIGRATE-06 boot refresh.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { bootRefreshIfNeeded } from "../../backends/boot-refresh";
import { bundledPromptsDir } from "../../backends/deploy-bundled-content";

describe("boot refresh", () => {
  let configDir: string;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
  });

  it("refreshes bundled content when app version differs", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-boot-refresh-"));
    mkdirSync(join(configDir, "prompts"), { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ last_app_version: "0.1.0" }) + "\n",
      "utf8",
    );
    writeFileSync(join(configDir, "prompts", "agents-base.md"), "# stale\n", "utf8");

    const refreshed = bootRefreshIfNeeded(configDir, "0.2.0");

    expect(refreshed).toBe(true);
    const bundled = readFileSync(join(bundledPromptsDir(), "agents-base.md"), "utf8");
    expect(readFileSync(join(configDir, "prompts", "agents-base.md"), "utf8")).toBe(bundled);
    expect(existsSync(join(configDir, "docs", "index.md"))).toBe(true);
    const config = JSON.parse(readFileSync(join(configDir, "config.json"), "utf8")) as {
      last_app_version?: string;
    };
    expect(config.last_app_version).toBe("0.2.0");
  });

  it("is a no-op when version matches", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-boot-refresh-"));
    mkdirSync(join(configDir, "prompts"), { recursive: true });
    writeFileSync(join(configDir, "prompts", "agents-base.md"), "# custom\n", "utf8");
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ last_app_version: "0.2.0" }) + "\n",
      "utf8",
    );

    const refreshed = bootRefreshIfNeeded(configDir, "0.2.0");

    expect(refreshed).toBe(false);
    expect(readFileSync(join(configDir, "prompts", "agents-base.md"), "utf8")).toBe("# custom\n");
  });

  it("creates config.json on fresh install", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-boot-refresh-"));

    const refreshed = bootRefreshIfNeeded(configDir, "0.1.0");

    expect(refreshed).toBe(true);
    expect(existsSync(join(configDir, "config.json"))).toBe(true);
    expect(existsSync(join(configDir, "prompts", "agents-base.md"))).toBe(true);
    expect(existsSync(join(configDir, "docs", "index.md"))).toBe(true);
    const config = JSON.parse(readFileSync(join(configDir, "config.json"), "utf8")) as {
      last_app_version?: string;
    };
    expect(config.last_app_version).toBe("0.1.0");
  });
});
