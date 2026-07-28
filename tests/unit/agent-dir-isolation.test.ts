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

import { ModelRuntime, formatSkillsForPrompt, loadSkills } from "@earendil-works/pi-coding-agent";

import {
  buddyAgentDir,
  buddyModelsPath,
  buddyModelsStorePath,
  globalConfigDir,
} from "../../backends/global-config";
import { createBuddyModelRuntime } from "../../backends/provider-auth";

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

// ---------------------------------------------------------------------------
// The second half of NFR-SEC-19, and the half H6b missed.
//
// H6b asked "which directory do we pass?" and answered it correctly for
// createAgentSession's resourceLoader. But `getAgentDir()` is the SDK's default
// for several paths, and ModelRuntime.create reaches it by its own route: given
// no `modelsPath`, it resolves `join(getAgentDir(), "models.json")` and loads
// the user's Pi CLI provider definitions. Confirmed on a real machine — Buddy
// reported the maintainer's personal `ollama` and `omlx` providers as its own.
//
// The right question is "which directories can the SDK still reach on its own",
// so these tests point PI_CODING_AGENT_DIR at a decoy and assert Buddy sees
// nothing in it.
// ---------------------------------------------------------------------------

describe("the SDK must not reach the Pi CLI directory on Buddy's behalf", () => {
  const MARKER = "pi-cli-decoy";
  let fakePiDir: string;
  let previousPiDir: string | undefined;
  let previousOffline: string | undefined;

  beforeEach(() => {
    fakePiDir = mkdtempSync(join(tmpdir(), "fake-pi-agent-"));
    writeFileSync(
      join(fakePiDir, "models.json"),
      JSON.stringify({
        providers: {
          [MARKER]: {
            name: "Decoy",
            baseUrl: "http://127.0.0.1:9/v1",
            api: "openai-completions",
            apiKey: "decoy",
            models: [{ id: "decoy-model" }],
          },
        },
      }),
      "utf8",
    );
    previousPiDir = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = fakePiDir;
    // Keep ModelRuntime.create off the network: it otherwise refreshes remote
    // catalogues with a 15 s budget, which has nothing to do with this test.
    previousOffline = process.env.PI_OFFLINE;
    process.env.PI_OFFLINE = "1";
  });

  afterEach(() => {
    if (previousPiDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousPiDir;
    if (previousOffline === undefined) delete process.env.PI_OFFLINE;
    else process.env.PI_OFFLINE = previousOffline;
    rmSync(fakePiDir, { recursive: true, force: true });
  });

  it("the decoy is real — an unguarded runtime does load it", async () => {
    // Guards the test below. Without this, a typo in the fixture would make the
    // isolation test pass for the wrong reason.
    const leaky = await ModelRuntime.create({ authPath: join(tmpConfig, "auth.json") });
    expect(leaky.getProviders().map((p) => p.id)).toContain(MARKER);
  });

  it("createBuddyModelRuntime does not load the Pi CLI's models.json", async () => {
    const runtime = await createBuddyModelRuntime();
    expect(runtime.getProviders().map((p) => p.id)).not.toContain(MARKER);
  });

  it("resolves models and their store inside the buddy config directory", () => {
    expect(buddyModelsPath()).toBe(join(globalConfigDir(), "models.json"));
    expect(buddyModelsStorePath()).toBe(join(globalConfigDir(), "models-store.json"));
    // models-store.json is written by the SDK on every refresh. Left to its
    // default it lands in dirname(modelsPath) — inside the user's ~/.pi/agent.
    expect(buddyModelsStorePath()).not.toContain(".pi");
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

  // The check above asks whether *we* call getAgentDir(). The leak was that the
  // SDK calls it for us: createAgentSession defaults `agentDir` when the option
  // is absent, and its SettingsManager then reads the user's Pi CLI settings.
  // Passing it is not optional, so its absence is a failure.
  it("every createAgentSession call passes an explicit agentDir", () => {
    const offenders: string[] = [];
    for (const { file, source } of sourcesIn(BACKENDS_DIR)) {
      // Each call's options object, from the opening brace to the matching
      // depth-0 close — nested objects (tools, customTools) are included.
      const re = /createAgentSession\s*\(\s*\{/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(source)) !== null) {
        let depth = 1;
        let i = match.index + match[0].length;
        while (i < source.length && depth > 0) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") depth--;
          i++;
        }
        if (!/\bagentDir\s*:/.test(source.slice(match.index, i))) offenders.push(file);
      }
    }
    expect(
      offenders,
      `createAgentSession without an explicit agentDir falls back to the SDK's ` +
        `getAgentDir() (~/.pi/agent), so SettingsManager reads the user's Pi CLI ` +
        `provider, model, thinking level and theme (NFR-SEC-19).`,
    ).toEqual([]);
  });

  it("finds the three call sites it is meant to be checking", () => {
    // Without this, deleting or renaming createAgentSession would make the
    // guard above pass by inspecting nothing at all.
    const calls = sourcesIn(BACKENDS_DIR).reduce(
      (total, { source }) => total + (source.match(/createAgentSession\s*\(\s*\{/g)?.length ?? 0),
      0,
    );
    expect(calls).toBe(3);
  });
});
