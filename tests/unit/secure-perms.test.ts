// tests/unit/secure-perms.test.ts — NFR-SEC-17 Windows ACL amend (spike A1).

import { describe, expect, it, vi } from "vitest";

import {
  applyRestrictiveAcl,
  windowsAclPrincipal,
} from "../../backends/secure-perms";

describe("windowsAclPrincipal", () => {
  it("prefixes USERDOMAIN when present", () => {
    expect(windowsAclPrincipal({ USERDOMAIN: "DESKTOP-X" }, "pedro")).toBe(
      "DESKTOP-X\\pedro",
    );
  });

  it("uses the bare username when USERDOMAIN is empty", () => {
    expect(windowsAclPrincipal({ USERDOMAIN: "" }, "pedro")).toBe("pedro");
  });
});

describe("applyRestrictiveAcl", () => {
  it("is a no-op on non-Windows platforms", () => {
    const runner = vi.fn();
    applyRestrictiveAcl("C:\\Users\\x\\.buddy", {
      platform: "linux",
      runner,
      env: { USERDOMAIN: "D" },
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("grants the current user then strips inheritance on win32", () => {
    const runner = vi.fn();
    applyRestrictiveAcl("C:\\Users\\x\\.buddy\\auth.json", {
      platform: "win32",
      runner,
      env: { USERDOMAIN: "DESKTOP-X" },
    });
    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner.mock.calls[0]).toEqual([
      "C:\\Users\\x\\.buddy\\auth.json",
      ["/grant:r", `${windowsAclPrincipal({ USERDOMAIN: "DESKTOP-X" })}:(F)`],
    ]);
    expect(runner.mock.calls[1]).toEqual([
      "C:\\Users\\x\\.buddy\\auth.json",
      ["/inheritance:r"],
    ]);
  });

  it("swallows runner failures and tries to restore inheritance", () => {
    const calls: string[][] = [];
    expect(() =>
      applyRestrictiveAcl("C:\\x", {
        platform: "win32",
        runner: (_path, args) => {
          calls.push(args);
          throw new Error("icacls missing");
        },
        env: { USERDOMAIN: "D" },
      }),
    ).not.toThrow();
    expect(calls.some((args) => args[0] === "/inheritance:e")).toBe(true);
  });
});
