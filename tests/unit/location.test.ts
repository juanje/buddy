// tests/unit/location.test.ts — FR-SETUP-03 location validation edge cases.

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultBuddyLocation, validateLocation } from "../../backends/location";

const tmpDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "ab-loc-unit-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("validateLocation", () => {
  it("accepts a path that does not exist", () => {
    expect(validateLocation(join(scratch(), "new-ab"))).toEqual({ status: "ok-new" });
  });

  it("accepts an empty directory", () => {
    const dir = join(scratch(), "empty");
    mkdirSync(dir);
    expect(validateLocation(dir)).toEqual({ status: "ok-empty" });
  });

  it("rejects a non-empty directory", () => {
    const dir = join(scratch(), "busy");
    mkdirSync(dir);
    writeFileSync(join(dir, "file.txt"), "x");
    expect(validateLocation(dir)).toEqual({ status: "not-empty" });
  });

  it("rejects a file path", () => {
    const file = join(scratch(), "a-file");
    writeFileSync(file, "x");
    expect(validateLocation(file)).toEqual({ status: "not-a-directory" });
  });

  it("recognizes an existing buddy instance by its agent_brain dir", () => {
    const dir = join(scratch(), "old-ab");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    expect(validateLocation(dir)).toEqual({ status: "existing-buddy" });
  });

  it("treats agent_brain as a plain entry when it is a file", () => {
    const dir = join(scratch(), "weird");
    mkdirSync(dir);
    writeFileSync(join(dir, "agent_brain"), "not a dir");
    expect(validateLocation(dir)).toEqual({ status: "not-empty" });
  });
});

describe("defaultBuddyLocation", () => {
  it("proposes buddy under the home directory", () => {
    expect(defaultBuddyLocation().endsWith("buddy")).toBe(true);
  });
});
