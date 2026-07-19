// tests/unit/prereqs.test.ts — FR-SETUP-02 prerequisites check.

import { describe, expect, it } from "vitest";

import { checkPrerequisites } from "../../backends/prereqs";

describe("checkPrerequisites", () => {
  it("reports git installed with its version", async () => {
    const status = await checkPrerequisites(async () => ({ stdout: "git version 2.44.0\n" }));
    expect(status.gitInstalled).toBe(true);
    expect(status.gitVersion).toBe("git version 2.44.0");
    expect(status.platform).toBe(process.platform);
  });

  it("reports git missing when the command fails", async () => {
    const status = await checkPrerequisites(async () => {
      throw new Error("ENOENT");
    });
    expect(status).toEqual({ gitInstalled: false, platform: process.platform });
  });
});
