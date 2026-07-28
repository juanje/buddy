// tests/unit/agent-dir-isolation.test.ts — NFR-SEC-19.
//
// NFR-AUTH-ISO isolated credentials by passing `authPath` explicitly. Nothing
// isolated the rest: `agentDir` also governs skills, settings.json, tools/,
// extensions/, prompts/, the trust store and models.json, and every session
// creator was passing the SDK's `getAgentDir()` — the user's Pi CLI directory.
//
// Reported from a live instance: a globally installed `wiki-kb` skill was
// advertised to the agent, which tried to read it from ~/.pi/ (a Zone 3
// permission prompt for a file outside the workspace) and found instructions
// requiring bash, which Buddy does not have.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatSkillsForPrompt, loadSkills } from "@earendil-works/pi-coding-agent";

import { buddyAgentDir, globalConfigDir } from "../../backends/global-config";

const BACKENDS_DIR = join(import.meta.dirname, "..", "..", "backends");
const SCRIPTS_DIR = join(import.meta.dirname, "..", "..", "scripts");

let previousConfigDir: string | undefined;
let tmpConfig: string;

beforeEach(() => {
  previousConfigDir = process.env.BUDDY_CONFIG_DIR;
  tmpConfig = mkdtempSync(join(tmpdir(), "agent-dir-"));
  process.env.BUDDY_CONFIG_DIR = tmpConfig;
});

afterEach(() => {
  if (previousConfigDir === undefined) delete process.env.BUDDY_CONFIG_DIR;
  else process.env.BUDDY_CONFIG_DIR = previousConfigDir;
  rmSync(tmpConfig, { recursive: true, force: true });
});

describe("buddyAgentDir", () => {
  it("lives under the buddy config directory, not ~/.pi", () => {
    const dir = buddyAgentDir();
    expect(dir).toBe(join(globalConfigDir(), "agent"));
    expect(dir).not.toContain(".pi");
  });

  it("creates the directory on demand", () => {
    expect(readdirSync(buddyAgentDir())).toEqual([]);
  });
});

describe("skill isolation", () => {
  it("loads no skills from a buddy-owned agent directory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "agent-dir-cwd-"));
    try {
      const result = loadSkills({
        cwd,
        agentDir: buddyAgentDir(),
        skillPaths: [],
        includeDefaults: true,
      });
      expect(result.skills).toEqual([]);
      expect(result.diagnostics).toEqual([]);
      // Nothing is advertised to the model, so nothing can be reached for.
      expect(formatSkillsForPrompt(result.skills)).toBe("");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("would have loaded a skill placed in that directory", () => {
    // Guards the test above: proves the empty result comes from isolation, not
    // from loadSkills silently doing nothing here.
    const cwd = mkdtempSync(join(tmpdir(), "agent-dir-cwd-"));
    const skillDir = join(buddyAgentDir(), "skills", "demo");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      "---\nname: demo\ndescription: A demo skill\n---\n\nBody.\n",
      "utf8",
    );
    try {
      const result = loadSkills({
        cwd,
        agentDir: buddyAgentDir(),
        skillPaths: [],
        includeDefaults: true,
      });
      expect(result.skills.map((s) => s.name)).toEqual(["demo"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("no production code reaches the Pi CLI agent directory", () => {
  // A guard, not a behavioural test: the defect was three call sites each
  // passing getAgentDir(), and a new session creator could reintroduce it.
  /** Strip comments: the guard must judge code, not the prose describing it. */
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
  ])("no file in %s calls getAgentDir()", (_label, dir) => {
    const offenders = sourcesIn(dir)
      .filter(({ source }) => /\bgetAgentDir\s*\(/.test(source))
      .map(({ file }) => file);
    expect(
      offenders,
      `these files call the SDK's getAgentDir(), which resolves to ~/.pi/agent and ` +
        `pulls the user's Pi CLI skills, settings, tools and extensions into Buddy ` +
        `(NFR-SEC-19). Use buddyAgentDir() instead.`,
    ).toEqual([]);
  });
});
