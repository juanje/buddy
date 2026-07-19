// tests/unit/permissions.test.ts — FR-PERM zone classification edge cases.

import { describe, expect, it } from "vitest";

import { evaluateToolCall, createPermissionGate } from "../../backends/permissions";

const HOME = "/home/u";
const AB = "/home/u/my-ab";

const evaluate = (tool: string, args: unknown) => evaluateToolCall(tool, args, AB, HOME);

describe("evaluateToolCall", () => {
  it("allows non-file tools", () => {
    expect(evaluate("think", { note: "x" })).toEqual({ action: "allow" });
  });

  it("allows pathless ls/grep (session cwd is the AB)", () => {
    expect(evaluate("ls", {})).toEqual({ action: "allow" });
    expect(evaluate("grep", { pattern: "foo" })).toEqual({ action: "allow" });
  });

  it("allows reads and writes inside the AB", () => {
    expect(evaluate("read", { path: `${AB}/agent_brain/notes.md` })).toEqual({ action: "allow" });
    expect(evaluate("write", { path: `${AB}/user/inbox.md` })).toEqual({ action: "allow" });
  });

  it("resolves relative paths against the AB", () => {
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

  it("asks for outside paths with the operation kind", () => {
    const read = evaluate("read", { path: "/home/u/Documents/cv.md" });
    expect(read).toMatchObject({ action: "ask", kind: "outside", op: "read" });
    const write = evaluate("write", { path: "/home/u/Documents/cv.md" });
    expect(write).toMatchObject({ action: "ask", kind: "outside", op: "write" });
  });

  it("denies the hardcoded denylist silently, wherever it appears", () => {
    for (const path of [
      "/home/u/.ssh/id_rsa",
      "/home/u/.gnupg/pubring.kbx",
      "/home/u/.aws/credentials",
      "/anywhere/project/.env",
      `${AB}/secrets/auth.json`, // even inside the AB
      "~/.ssh/config", // tilde expansion
    ]) {
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
});
