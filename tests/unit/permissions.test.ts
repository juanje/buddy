// tests/unit/permissions.test.ts — FR-PERM zone classification edge cases.

import { describe, expect, it } from "vitest";
import { join } from "node:path";

import { evaluateToolCall, createPermissionGate } from "../../backends/permissions";
import { DENYLIST_BASENAMES, DENYLIST_HOME_DIRS } from "../../shared/defaults";

const HOME = "/home/u";
const AB = "/home/u/buddy";
const CONFIG = join(HOME, ".buddy");

const evaluate = (tool: string, args: unknown) => evaluateToolCall(tool, args, AB, HOME, CONFIG);

describe("evaluateToolCall", () => {
  it("allows non-file tools", () => {
    expect(evaluate("think", { note: "x" })).toEqual({ action: "allow" });
  });

  it("allows pathless ls/grep (session cwd is the buddy directory)", () => {
    expect(evaluate("ls", {})).toEqual({ action: "allow" });
    expect(evaluate("grep", { pattern: "foo" })).toEqual({ action: "allow" });
  });

  it("allows reads and writes inside the buddy directory", () => {
    expect(evaluate("read", { path: `${AB}/agent_brain/notes.md` })).toEqual({ action: "allow" });
    expect(evaluate("write", { path: `${AB}/user/inbox.md` })).toEqual({ action: "allow" });
  });

  it("resolves relative paths against the buddy directory", () => {
    expect(evaluate("read", { path: "user/inbox.md" })).toEqual({ action: "allow" });
    const escape = evaluate("read", { path: "../other/file.txt" });
    expect(escape.action).toBe("ask");
  });

  it("asks for SOUL.md writes but not USER.md writes", () => {
    const soulWrite = evaluate("edit", { path: `${AB}/agent_brain/identity/SOUL.md` });
    expect(soulWrite).toMatchObject({ action: "ask", kind: "identity-write", op: "write" });
    expect(evaluate("write", { path: `${AB}/agent_brain/identity/USER.md` })).toEqual({
      action: "allow",
    });
    expect(evaluate("read", { path: `${AB}/agent_brain/identity/SOUL.md` })).toEqual({
      action: "allow",
    });
  });

  it("allows reads under ~/.buddy/docs/ without asking (FR-DOCS-01)", () => {
    expect(evaluate("read", { path: `${CONFIG}/docs/index.md` })).toEqual({ action: "allow" });
    expect(evaluate("read", { path: "~/.buddy/docs/capabilities.md" })).toEqual({ action: "allow" });
  });

  it("still asks for writes under ~/.buddy/docs/", () => {
    const decision = evaluate("write", { path: `${CONFIG}/docs/index.md` });
    expect(decision).toMatchObject({ action: "ask", kind: "outside", op: "write" });
  });

  it("asks for outside paths with the operation kind", () => {
    const read = evaluate("read", { path: "/home/u/Documents/cv.md" });
    expect(read).toMatchObject({ action: "ask", kind: "outside", op: "read" });
    const write = evaluate("write", { path: "/home/u/Documents/cv.md" });
    expect(write).toMatchObject({ action: "ask", kind: "outside", op: "write" });
  });

  it("denies writes to .pi/settings.json inside the buddy directory (NFR-SEC-06)", () => {
    const decision = evaluate("write", { path: `${AB}/.pi/settings.json` });
    expect(decision).toEqual({
      action: "deny",
      reason: "Modifying model configuration is not allowed.",
    });
    expect(evaluate("read", { path: `${AB}/.pi/settings.json` })).toEqual({ action: "allow" });
  });

  it("denies the hardcoded denylist silently, wherever it appears", () => {
    const denylistPaths = [
      ...DENYLIST_HOME_DIRS.map((dir) => `/home/u/${dir}/secret`),
      `/anywhere/project/${DENYLIST_BASENAMES[0]}`,
      `${AB}/secrets/${DENYLIST_BASENAMES[1]}`,
      `~/${DENYLIST_HOME_DIRS[0]}/config`,
    ];
    for (const path of denylistPaths) {
      const decision = evaluate("read", { path });
      expect(decision.action, path).toBe("deny");
    }
  });
});

describe("createPermissionGate sessionAllowedPaths", () => {
  it("allows reads for attached outside paths without asking", async () => {
    const allowed = new Set(["/home/u/Documents/draft.md"]);
    const gate = createPermissionGate(
      AB,
      async () => {
        throw new Error("should not ask");
      },
      HOME,
      { sessionAllowedPaths: allowed },
    );
    const outcome = await gate.check("read", { path: "/home/u/Documents/draft.md" });
    expect(outcome).toBeUndefined();
  });

  it("denies reads for denylist paths even when sessionAllowedPaths includes them", async () => {
    const allowed = new Set(["/anywhere/project/.env"]);
    const gate = createPermissionGate(
      AB,
      async () => {
        throw new Error("should not ask");
      },
      HOME,
      { sessionAllowedPaths: allowed },
    );
    const outcome = await gate.check("read", { path: "/anywhere/project/.env" });
    expect(outcome).toEqual({
      block: true,
      reason: "Access to /anywhere/project/.env is not allowed.",
    });
  });
});
