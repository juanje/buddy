// tests/unit/resource-isolation.test.ts — NFR-SEC-21.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

import { buddyAgentDir } from "../../backends/global-config";
import { createDateGuardExtension } from "../../backends/date-guard";
import {
  APPEND_SYSTEM_MARKER,
  installResourceLeakDecoys,
  PARENT_AGENTS_MARKER,
  ROOT_AGENTS_MARKER,
} from "../support/resource-isolation-capture";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

const BACKENDS_DIR = join(import.meta.dirname, "..", "..", "backends");
const SCRIPTS_DIR = join(import.meta.dirname, "..", "..", "scripts");

describe("NFR-SEC-21 resource loader fixture", () => {
  let tmpDir: string;
  let homeDir: string;
  let rootDir: string;
  let globalConfigDir: string | undefined;
  let previousHome: string | undefined;

  beforeEach(() => {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir());
    tmpDir = mkdtempSync(join(tmpdir(), "resource-iso-unit-"));
    homeDir = mkdtempSync(join(tmpdir(), "resource-iso-home-"));
    previousHome = process.env.HOME;
    process.env.HOME = homeDir;
    const parentDir = join(tmpDir, "parent");
    rootDir = join(parentDir, "buddy");
    mkdirSync(rootDir, { recursive: true });
    installResourceLeakDecoys(parentDir, rootDir, homeDir);
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    teardownGlobalConfigDir(globalConfigDir);
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  });

  it("an unguarded DefaultResourceLoader discovers decoy agents files and skills", async () => {
    const loader = new DefaultResourceLoader({
      cwd: rootDir,
      agentDir: buddyAgentDir(),
      systemPromptOverride: () => "Buddy preamble only.",
    });
    await loader.reload();

    expect(loader.getAgentsFiles().agentsFiles.length).toBeGreaterThan(0);
    expect(loader.getAgentsFiles().agentsFiles.some((f) => f.content.includes(ROOT_AGENTS_MARKER))).toBe(
      true,
    );
    expect(loader.getAgentsFiles().agentsFiles.some((f) => f.content.includes(PARENT_AGENTS_MARKER))).toBe(
      true,
    );
    expect(loader.getSkills().skills.some((s) => s.name === "proj-skill")).toBe(true);
    expect(loader.getAppendSystemPrompt().join("\n")).toContain(APPEND_SYSTEM_MARKER);
    expect(loader.getSkills().skills.some((s) => s.name === "home-skill")).toBe(true);
  });
});

describe("createBuddyResourceLoader", () => {
  let tmpDir: string;
  let homeDir: string;
  let rootDir: string;
  let globalConfigDir: string | undefined;
  let previousHome: string | undefined;

  beforeEach(() => {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir());
    tmpDir = mkdtempSync(join(tmpdir(), "resource-iso-unit-"));
    homeDir = mkdtempSync(join(tmpdir(), "resource-iso-home-"));
    previousHome = process.env.HOME;
    process.env.HOME = homeDir;
    const parentDir = join(tmpDir, "parent");
    rootDir = join(parentDir, "buddy");
    mkdirSync(rootDir, { recursive: true });
    installResourceLeakDecoys(parentDir, rootDir, homeDir);
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    teardownGlobalConfigDir(globalConfigDir);
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  });

  it("returns empty discovery results while preserving Buddy system prompt override", async () => {
    const { createBuddyResourceLoader } = await import("../../backends/resource-loader");
    const preamble = "Buddy assembled preamble.";
    const loader = await createBuddyResourceLoader({
      cwd: rootDir,
      systemPrompt: () => preamble,
    });

    expect(loader.getAgentsFiles().agentsFiles).toEqual([]);
    expect(loader.getSkills().skills).toEqual([]);
    expect(loader.getPrompts().prompts).toEqual([]);
    expect(loader.getThemes().themes).toEqual([]);
    expect(loader.getAppendSystemPrompt()).toEqual([]);
    expect(loader.getSystemPrompt()).toBe(preamble);
  });

  it("still registers inline extension factories when noExtensions is true", async () => {
    const { createBuddyResourceLoader } = await import("../../backends/resource-loader");
    const sessionStart = new Date("2026-10-07T12:00:00Z");
    const loader = await createBuddyResourceLoader({
      cwd: rootDir,
      systemPrompt: () => "preamble",
      extensionFactories: [createDateGuardExtension(sessionStart)],
    });

    expect(loader.getExtensions().extensions.length).toBeGreaterThan(0);
  });
});

describe("production code uses createBuddyResourceLoader only", () => {
  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  function sourcesIn(dir: string): Array<{ file: string; source: string }> {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".generated.ts"))
      .map((file) => ({
        file,
        source: stripComments(readFileSync(join(dir, file), "utf8")),
      }));
  }

  it.each([
    ["backends", BACKENDS_DIR],
    ["scripts", SCRIPTS_DIR],
  ])("no file in %s constructs DefaultResourceLoader except resource-loader.ts", (_label, dir) => {
    const offenders = sourcesIn(dir)
      .filter(({ file, source }) => file !== "resource-loader.ts" && /new DefaultResourceLoader\s*\(/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("finds exactly eight createBuddyResourceLoader call sites in backends and scripts", () => {
    const callPattern = /await createBuddyResourceLoader\s*\(/g;
    const count =
      sourcesIn(BACKENDS_DIR).reduce(
        (total, { file, source }) =>
          file === "resource-loader.ts" ? total : total + (source.match(callPattern)?.length ?? 0),
        0,
      ) +
      sourcesIn(SCRIPTS_DIR).reduce(
        (total, { source }) => total + (source.match(callPattern)?.length ?? 0),
        0,
      );
    expect(count).toBe(8);
  });
});
