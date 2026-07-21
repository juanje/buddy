// tests/unit/setup.test.ts — FR-SETUP-01 first-run detection edge cases.

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectFirstRun, updateAppConfig } from "../../backends/setup";

const tmpDirs: string[] = [];

function configIn(content?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ab-setup-unit-"));
  tmpDirs.push(dir);
  const path = join(dir, "config.json");
  if (content !== undefined) writeFileSync(path, content);
  return path;
}

afterEach(() => {
  while (tmpDirs.length > 0) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("detectFirstRun", () => {
  it("is first run when the config file is missing", () => {
    expect(detectFirstRun(configIn())).toEqual({ firstRun: true });
  });

  it("is configured when abDirectory is a non-empty string", () => {
    const state = detectFirstRun(
      configIn(JSON.stringify({ abDirectory: "/tmp/buddy", provider: "anthropic", model: "m" })),
    );
    expect(state.firstRun).toBe(false);
    if (!state.firstRun) expect(state.config.abDirectory).toBe("/tmp/buddy");
  });

  it("is first run when abDirectory is missing", () => {
    expect(detectFirstRun(configIn(JSON.stringify({ provider: "anthropic" })))).toEqual({
      firstRun: true,
    });
  });

  it("is first run when abDirectory is empty or blank", () => {
    expect(detectFirstRun(configIn(JSON.stringify({ abDirectory: "" })))).toEqual({
      firstRun: true,
    });
    expect(detectFirstRun(configIn(JSON.stringify({ abDirectory: "   " })))).toEqual({
      firstRun: true,
    });
  });

  it("is first run when abDirectory has the wrong type", () => {
    expect(detectFirstRun(configIn(JSON.stringify({ abDirectory: 42 })))).toEqual({
      firstRun: true,
    });
  });

  it("is first run when the file is corrupted JSON", () => {
    expect(detectFirstRun(configIn("{ not valid json"))).toEqual({ firstRun: true });
  });
});

describe("updateAppConfig", () => {
  it("merges language into an existing config file", () => {
    const path = configIn(
      JSON.stringify({
        abDirectory: "/tmp/buddy",
        provider: "anthropic",
        model: "claude-sonnet-5",
        language: "es",
      }),
    );
    const updated = updateAppConfig({ language: "en" }, path);
    expect(updated.language).toBe("en");
    expect(updated.abDirectory).toBe("/tmp/buddy");
    const reread = detectFirstRun(path);
    expect(reread.firstRun).toBe(false);
    if (!reread.firstRun) expect(reread.config.language).toBe("en");
  });
});
