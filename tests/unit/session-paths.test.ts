// tests/unit/session-paths.test.ts — NFR-SEC-19 session storage path helper.

import { describe, expect, it } from "vitest";
import { join } from "node:path";

import { buddySessionsDir } from "../../backends/session-paths";
import { SESSIONS_DIR } from "../../shared/defaults";

describe("buddySessionsDir", () => {
  it("resolves under the buddy instance root", () => {
    const root = "/home/user/my-buddy";
    expect(buddySessionsDir(root)).toBe(join(root, SESSIONS_DIR));
  });

  it("does not reference the Pi CLI agent directory", () => {
    expect(buddySessionsDir("/tmp/buddy")).not.toContain(".pi");
  });
});
