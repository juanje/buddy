// tests/unit/deploy-bundled-content.test.ts — NFR-MIGRATE-06 prompt deploy hygiene.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { bundledPromptsDir, deployBundledPrompts } from "../../backends/deploy-bundled-content";

describe("deployBundledPrompts", () => {
  let configDir: string;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
  });

  it("removes prompt files not in the current bundle", () => {
    configDir = mkdtempSync(join(tmpdir(), "buddy-deploy-prompts-"));
    const promptsDir = join(configDir, "prompts");
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(promptsDir, "stale-skill.md"), "# Retired skill\n", "utf8");

    deployBundledPrompts(configDir);

    expect(existsSync(join(promptsDir, "stale-skill.md"))).toBe(false);

    const bundledNames = readdirSync(bundledPromptsDir()).filter((n) => n.endsWith(".md"));
    for (const name of bundledNames) {
      expect(existsSync(join(promptsDir, name))).toBe(true);
    }
  });
});
