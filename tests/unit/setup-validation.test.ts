// tests/unit/setup-validation.test.ts — FR-SETUP-11, FR-SETUP-12.
//
// Validation lived only in the wizard: `runSetup` trusted whatever path the
// frontend sent. That is the shape H1 spent a sprint removing — the frontend
// decides what to *offer*, the worker decides what is *allowed* (NFR-SEC-08).
// The failure is not subtle: cpSync runs with force: true and `git init`
// follows, inside a directory of the user's own files.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertSetupLocationAllowed,
  missingInstanceParts,
  validateLocation,
} from "../../backends/location";
import {
  adoptBuddyInstance,
  ensureRuntimeStateIgnored,
  ensureTextEolAttributes,
} from "../../backends/create-buddy";
import { initTestGitRepo } from "../support/test-git";

let base: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "setup-validation-"));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

/** A directory that looks complete enough to adopt. */
async function completeInstance(name = "instance"): Promise<string> {
  const dir = join(base, name);
  mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(dir, "AGENTS.md"), "# Rules\n");
  writeFileSync(join(dir, "agent_brain", "identity", "SOUL.md"), "# Soul\n");
  writeFileSync(join(dir, "agent_brain", "identity", "USER.md"), "# User\n");
  writeFileSync(join(dir, "agent_brain", "deferred.md"), "# Deferred\n");
  await initTestGitRepo(dir);
  return dir;
}

describe("missingInstanceParts", () => {
  it("reports nothing for a complete instance", async () => {
    expect(missingInstanceParts(await completeInstance())).toEqual([]);
  });

  it("accepts an instance missing a git repo — that is repaired, not refused", async () => {
    const dir = await completeInstance();
    rmSync(join(dir, ".git"), { recursive: true, force: true });
    expect(missingInstanceParts(dir)).toEqual([]);
  });

  it("accepts an instance with only one identity file", async () => {
    // A hand-made instance is not required to match the template.
    const dir = await completeInstance();
    rmSync(join(dir, "agent_brain", "identity", "USER.md"));
    expect(missingInstanceParts(dir)).toEqual([]);
  });

  it("refuses a directory with no identity at all", async () => {
    const dir = await completeInstance();
    rmSync(join(dir, "agent_brain", "identity"), { recursive: true, force: true });
    expect(missingInstanceParts(dir)).toHaveLength(1);
  });
});

describe("validateLocation", () => {
  it("offers a complete instance for import", async () => {
    expect(validateLocation(await completeInstance()).status).toBe("existing-buddy");
  });

  it("reports the wreckage of a failed setup as incomplete, not importable", async () => {
    // What createBuddyInstance leaves behind when it fails partway: agent_brain/
    // exists but the identity files were never copied.
    const dir = join(base, "half-created");
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    writeFileSync(join(dir, "AGENTS.md"), "# Rules\n");

    const check = validateLocation(dir);
    expect(check.status).toBe("incomplete-buddy");
    expect(check.missing?.join(" ")).toMatch(/identity/i);
  });

  it("still reports a non-buddy directory as not-empty", () => {
    const dir = join(base, "documents");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "taxes.pdf"), "x");
    expect(validateLocation(dir).status).toBe("not-empty");
  });
});

describe("assertSetupLocationAllowed", () => {
  it("allows creating in a new or empty folder", () => {
    expect(() => assertSetupLocationAllowed(join(base, "brand-new"), "create")).not.toThrow();
    const empty = join(base, "empty");
    mkdirSync(empty);
    expect(() => assertSetupLocationAllowed(empty, "create")).not.toThrow();
  });

  it("refuses to create inside a folder that already has files", () => {
    // The case that matters: cpSync(force: true) plus `git init` over the
    // user's own documents.
    const dir = join(base, "documents");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "taxes.pdf"), "x");
    expect(() => assertSetupLocationAllowed(dir, "create")).toThrow(/already has files/);
  });

  it("refuses to create where an instance already lives", async () => {
    const dir = await completeInstance();
    expect(() => assertSetupLocationAllowed(dir, "create")).toThrow();
  });

  it("allows importing a complete instance", async () => {
    const dir = await completeInstance();
    expect(() => assertSetupLocationAllowed(dir, "import")).not.toThrow();
  });

  it("refuses to import wreckage with no identity, naming what is missing", async () => {
    // What a failed createBuddyInstance leaves behind: agent_brain/ and little
    // else. Adopting it produced a permanently broken install.
    const dir = await completeInstance();
    rmSync(join(dir, "agent_brain", "identity"), { recursive: true, force: true });
    expect(() => assertSetupLocationAllowed(dir, "import")).toThrow(/identity/i);
  });

  it("still allows importing an instance that merely lacks a git repo", async () => {
    const dir = await completeInstance();
    rmSync(join(dir, ".git"), { recursive: true, force: true });
    expect(() => assertSetupLocationAllowed(dir, "import")).not.toThrow();
  });

  it("refuses to import a folder that holds no instance", () => {
    const dir = join(base, "documents");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "taxes.pdf"), "x");
    expect(() => assertSetupLocationAllowed(dir, "import")).toThrow(
      /does not contain an assistant/i,
    );
  });
});

describe("ensureRuntimeStateIgnored", () => {
  it("creates .gitignore when the adopted instance has none", () => {
    const dir = join(base, "no-ignore");
    mkdirSync(dir, { recursive: true });

    ensureRuntimeStateIgnored(dir);

    const content = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(content).toContain(".buddy/");
    expect(content).toContain(".pi/");
  });

  it("appends only what is missing, preserving the user's rules", () => {
    const dir = join(base, "partial-ignore");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n.buddy/\n", "utf8");

    ensureRuntimeStateIgnored(dir);

    const content = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(content).toContain("node_modules/");
    expect(content.match(/^\.buddy\/$/gm)).toHaveLength(1); // not duplicated
    expect(content).toContain(".pi/");
  });

  it("does nothing when both rules are already present", () => {
    const dir = join(base, "complete-ignore");
    mkdirSync(dir, { recursive: true });
    const original = ".buddy/\n.pi/\n";
    writeFileSync(join(dir, ".gitignore"), original, "utf8");

    ensureRuntimeStateIgnored(dir);

    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe(original);
  });

  it("is applied when an instance is adopted", async () => {
    const dir = await completeInstance("adopted");
    rmSync(join(dir, ".gitignore"), { force: true });

    adoptBuddyInstance({
      config: { rootDir: dir, provider: "anthropic", model: "m" },
      configPath: join(base, "config.json"),
    });

    // Without this, every auto-commit versions Buddy's own locks and session
    // state into the user's repository.
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".buddy/");
  });
});

describe("ensureTextEolAttributes (NFR-PORT-08)", () => {
  it("creates .gitattributes with eol=lf when absent", () => {
    const dir = join(base, "no-attrs");
    mkdirSync(dir, { recursive: true });

    ensureTextEolAttributes(dir);

    const content = readFileSync(join(dir, ".gitattributes"), "utf8");
    expect(content).toMatch(/eol\s*=\s*lf/i);
    expect(content).toMatch(/^\*\s+text=auto\s+eol=lf/m);
  });

  it("leaves an existing eol=lf policy untouched", () => {
    const dir = join(base, "has-attrs");
    mkdirSync(dir, { recursive: true });
    const original = "* text=auto eol=lf\n";
    writeFileSync(join(dir, ".gitattributes"), original, "utf8");

    ensureTextEolAttributes(dir);

    expect(readFileSync(join(dir, ".gitattributes"), "utf8")).toBe(original);
  });

  it("appends eol=lf when a .gitattributes exists without it", () => {
    const dir = join(base, "partial-attrs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".gitattributes"), "*.png binary\n", "utf8");

    ensureTextEolAttributes(dir);

    const content = readFileSync(join(dir, ".gitattributes"), "utf8");
    expect(content).toContain("*.png binary");
    expect(content).toMatch(/eol\s*=\s*lf/i);
  });

  it("is applied when an instance is adopted without attributes", async () => {
    const dir = await completeInstance("adopted-attrs");
    rmSync(join(dir, ".gitattributes"), { force: true });

    adoptBuddyInstance({
      config: { rootDir: dir, provider: "anthropic", model: "m" },
      configPath: join(base, "config-attrs.json"),
    });

    expect(readFileSync(join(dir, ".gitattributes"), "utf8")).toMatch(/eol\s*=\s*lf/i);
  });
});
