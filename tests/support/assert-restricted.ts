// tests/support/assert-restricted.ts — NFR-SEC-17 assertions for unit + BDD.
//
// Review D4: one helper for POSIX mode bits and Windows ACLs so provider-auth,
// state-preservation, config-permissions, and setup-provider steps agree.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { userInfo } from "node:os";

/** Assert a path is owner-only (0600/0700 on POSIX; no BUILTIN\Users on Windows). */
export function assertRestricted(path: string, posixMode: number): void {
  if (process.platform === "win32") {
    const listing = execFileSync("icacls", [path], { encoding: "utf8" });
    assert.match(listing, /\(F\)/, `expected (F) ACE on ${path}, got:\n${listing}`);
    assert.ok(
      !listing.toLowerCase().includes("builtin\\users"),
      `expected no BUILTIN\\Users ACE on ${path}, got:\n${listing}`,
    );
    assert.ok(
      listing.toLowerCase().includes(userInfo().username.toLowerCase()),
      `expected current user in ACL on ${path}, got:\n${listing}`,
    );
  } else {
    assert.equal(statSync(path).mode & 0o777, posixMode, path);
  }
}
