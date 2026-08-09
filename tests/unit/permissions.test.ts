// tests/unit/permissions.test.ts — FR-PERM zone classification edge cases.

import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  evaluateToolCall,
  createPermissionGate,
  isDenylistedPath,
  windowsDenylistRoots,
} from "../../backends/permissions";
import { DENYLIST_BASENAMES, DENYLIST_HOME_DIRS } from "../../shared/defaults";

// A real directory, not a fabricated "/home/u". Containment resolves symlinks
// now (NFR-SEC-15), so these paths are read by the filesystem rather than only
// compared as strings — and a path that cannot exist cannot be a symlink,
// which would make every case here the easy one.
const HOME = mkdtempSync(join(tmpdir(), "permissions-"));
const AB = join(HOME, "buddy");
const CONFIG = join(HOME, ".buddy");

mkdirSync(join(AB, "agent_brain", "identity"), { recursive: true });
mkdirSync(join(AB, ".pi"), { recursive: true });
mkdirSync(join(AB, "user"), { recursive: true });
mkdirSync(join(CONFIG, "docs"), { recursive: true });
mkdirSync(join(HOME, "Documents"), { recursive: true });

afterAll(() => {
  rmSync(HOME, { recursive: true, force: true });
});

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
    const read = evaluate("read", { path: `${HOME}/Documents/cv.md` });
    expect(read).toMatchObject({ action: "ask", kind: "outside", op: "read" });
    const write = evaluate("write", { path: `${HOME}/Documents/cv.md` });
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
      ...DENYLIST_HOME_DIRS.map((dir) => `${HOME}/${dir}/secret`),
      `/anywhere/project/${DENYLIST_BASENAMES[0]}`,
      `${AB}/secrets/${DENYLIST_BASENAMES[1]}`,
      `~/${DENYLIST_HOME_DIRS[0]}/config`,
    ];
    for (const path of denylistPaths) {
      const decision = evaluate("read", { path });
      expect(decision.action, path).toBe("deny");
    }
  });

  // NFR-SEC-04 / FR-PERM-04 (spike A2) — capitalisation must not open a hole.
  it("denies denylist basenames regardless of letter case", () => {
    const cased = [
      `${AB}/secrets/.ENV`,
      `${AB}/secrets/.Env`,
      `${AB}/secrets/Auth.json`,
      `${AB}/secrets/AUTH.JSON`,
      `${HOME}/project/.eNv`,
    ];
    for (const path of cased) {
      expect(isDenylistedPath(path, HOME), path).toBe(true);
      expect(evaluate("read", { path }).action, path).toBe("deny");
    }
  });

  // NFR-SEC-21 / spike A3 — Windows GnuPG + Credential Manager (not ~/.gnupg).
  it("denies Windows AppData gnupg and Credential Manager paths", () => {
    const appdata = join(HOME, "AppData", "Roaming");
    const local = join(HOME, "AppData", "Local");
    mkdirSync(join(appdata, "gnupg", "private-keys-v1.d"), { recursive: true });
    mkdirSync(join(appdata, "Microsoft", "Credentials"), { recursive: true });
    mkdirSync(join(local, "Microsoft", "Credentials"), { recursive: true });

    const env = { APPDATA: appdata, LOCALAPPDATA: local };
    expect(windowsDenylistRoots(env)).toEqual([
      join(appdata, "gnupg"),
      join(appdata, "Microsoft", "Credentials"),
      join(local, "Microsoft", "Credentials"),
    ]);

    const secrets = [
      join(appdata, "gnupg", "private-keys-v1.d", "key"),
      join(appdata, "Microsoft", "Credentials", "blob"),
      join(local, "Microsoft", "Credentials", "blob"),
    ];
    for (const path of secrets) {
      expect(isDenylistedPath(path, HOME, env), path).toBe(true);
    }
    // Without AppData env (POSIX-like), those absolute paths are not denylisted
    // by the Windows roots — only basename / ~/.gnupg rules apply.
    expect(isDenylistedPath(secrets[0], HOME, {})).toBe(false);

    // Production path: evaluateToolCall reads process.env.
    const prevApp = process.env.APPDATA;
    const prevLocal = process.env.LOCALAPPDATA;
    process.env.APPDATA = appdata;
    process.env.LOCALAPPDATA = local;
    try {
      for (const path of secrets) {
        expect(evaluateToolCall("read", { path }, AB, HOME).action, path).toBe("deny");
      }
    } finally {
      if (prevApp === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = prevApp;
      if (prevLocal === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = prevLocal;
    }
  });
});

describe("createPermissionGate sessionAllowedPaths", () => {
  it("allows reads for attached outside paths without asking", async () => {
    const allowed = new Set([`${HOME}/Documents/draft.md`]);
    const gate = createPermissionGate(
      AB,
      async () => {
        throw new Error("should not ask");
      },
      HOME,
      { sessionAllowedPaths: allowed },
    );
    const outcome = await gate.check("read", { path: `${HOME}/Documents/draft.md` });
    expect(outcome).toBeUndefined();
  });

  it("denies reads for denylist paths even when sessionAllowedPaths includes them", async () => {
    // Use a real absolute path — `resolve` on Windows rewrites `/anywhere/...`
    // to a drive-rooted form, which made a POSIX-literal reason assertion fail
    // without testing the denylist property.
    const envPath = join(HOME, "project", ".env");
    const allowed = new Set([envPath]);
    const gate = createPermissionGate(
      AB,
      async () => {
        throw new Error("should not ask");
      },
      HOME,
      { sessionAllowedPaths: allowed },
    );
    const outcome = await gate.check("read", { path: envPath });
    expect(outcome?.block).toBe(true);
    expect(outcome?.reason).toMatch(/\.env/);
  });
});
