// tests/unit/ensure-directory.test.ts — NFR-PORT-11 Bun/Windows mkdir adopt.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearWindowsDirectoryReadOnly,
  ensureDirectory,
} from "../../backends/ensure-directory";
import { copyTemplates, createBuddyInstance, defaultTemplatesDir } from "../../backends/create-buddy";
import { registerEmbeddedAssets } from "../../backends/embedded-assets";

const tmpDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "buddy-ensure-dir-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  registerEmbeddedAssets(undefined);
  while (tmpDirs.length > 0) {
    rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ensureDirectory", () => {
  it("creates a missing directory and parents", () => {
    const root = scratch();
    const nested = join(root, "a", "b", "c");
    ensureDirectory(nested);
    expect(statSync(nested).isDirectory()).toBe(true);
  });

  it("adopts an existing empty directory without throwing", () => {
    const dir = join(scratch(), "empty");
    mkdirSync(dir);
    expect(() => ensureDirectory(dir)).not.toThrow();
    expect(readdirSync(dir)).toEqual([]);
  });

  it("adopts an existing non-empty directory without throwing", () => {
    const dir = join(scratch(), "has-files");
    mkdirSync(dir);
    writeFileSync(join(dir, "note.txt"), "x");
    expect(() => ensureDirectory(dir)).not.toThrow();
    expect(existsSync(join(dir, "note.txt"))).toBe(true);
  });

  it("refuses a path that is a file", () => {
    const file = join(scratch(), "not-a-dir");
    writeFileSync(file, "x");
    expect(() => ensureDirectory(file)).toThrow(/not a folder/i);
  });

  it("clearWindowsDirectoryReadOnly is a no-op off Windows", () => {
    const calls: string[][] = [];
    clearWindowsDirectoryReadOnly("/tmp/x", {
      platform: "linux",
      runner: (args) => calls.push(args),
    });
    expect(calls).toEqual([]);
  });

  it("clearWindowsDirectoryReadOnly invokes attrib -R on Windows", () => {
    const calls: string[][] = [];
    clearWindowsDirectoryReadOnly("D:\\buddy", {
      platform: "win32",
      runner: (args) => calls.push(args),
    });
    expect(calls).toEqual([["-R", "D:\\buddy"]]);
  });
});

describe("createBuddyInstance into an existing empty directory (NFR-PORT-11)", () => {
  it("succeeds when the home folder already exists and is empty", async () => {
    const base = scratch();
    const root = join(base, "existing-empty");
    mkdirSync(root);
    const configPath = join(base, "config.json");

    await createBuddyInstance({
      config: {
        rootDir: root,
        provider: "anthropic",
        model: "claude-haiku-4-5",
        language: "es",
        name: "Pedro",
      },
      configPath,
      templatesDir: defaultTemplatesDir(),
    });

    expect(existsSync(join(root, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(root, "agent_brain", "identity", "SOUL.md"))).toBe(true);
    expect(existsSync(join(root, ".git"))).toBe(true);
  });

  it("copyTemplates with embedded assets adopts an existing empty dir", () => {
    const base = scratch();
    const root = join(base, "empty-home");
    mkdirSync(root);
    registerEmbeddedAssets({
      templates: {
        "AGENTS.md": "# agents\n",
        "agent_brain/identity/SOUL.md": "# soul\n",
      },
      prompts: {},
      docs: {},
    });

    copyTemplates(root);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe("# agents\n");
    expect(existsSync(join(root, "agent_brain", "identity", "SOUL.md"))).toBe(true);
  });
});

describe.runIf(process.platform === "win32")("Windows Explorer ReadOnly directories", () => {
  it("ensureDirectory clears ReadOnly so Bun-style re-mkdir would succeed", () => {
    const dir = join(scratch(), "readonly-empty");
    mkdirSync(dir);
    execFileSync("attrib", ["+R", dir], { stdio: "ignore" });

    expect(() => ensureDirectory(dir)).not.toThrow();

    // Mimic what Bun's recursive mkdir does after our adopt: must not EEXIST.
    expect(() => mkdirSync(dir, { recursive: true })).not.toThrow();
  });

  it("createBuddyInstance succeeds into an Explorer ReadOnly empty folder", async () => {
    const base = scratch();
    const root = join(base, "ro-empty");
    mkdirSync(root);
    execFileSync("attrib", ["+R", root], { stdio: "ignore" });
    const configPath = join(base, "config.json");

    await createBuddyInstance({
      config: {
        rootDir: root,
        provider: "anthropic",
        model: "claude-haiku-4-5",
        language: "es",
        name: "Pedro",
      },
      configPath,
      templatesDir: defaultTemplatesDir(),
    });

    expect(existsSync(join(root, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(root, ".git"))).toBe(true);
  });
});
