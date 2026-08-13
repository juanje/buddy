// tests/unit/ensure-git-repository.test.ts — review D8 / spike E.
//
// An adopted clone may already have `.git` without local user.name/email.
// Auto-commit then fails forever unless we fill the identity.

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";

import { ensureGitRepository } from "../../backends/create-buddy";
import { GIT_USER_EMAIL, GIT_USER_NAME } from "../../shared/defaults";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "buddy-ensure-git-"));
  dirs.push(dir);
  return dir;
}

describe("ensureGitRepository", () => {
  it("inits and sets identity when .git is absent", async () => {
    const root = scratch();
    expect(await ensureGitRepository(root)).toBe(true);
    const git = simpleGit(root);
    expect((await git.getConfig("user.name")).value).toBe(GIT_USER_NAME);
    expect((await git.getConfig("user.email")).value).toBe(GIT_USER_EMAIL);
  });

  it("fills missing identity on an adopted repo (review D8)", async () => {
    const root = scratch();
    await simpleGit(root).init();
    // No user.name / user.email — the spike E failure mode.
    expect(await ensureGitRepository(root)).toBe(false);
    const git = simpleGit(root);
    expect((await git.getConfig("user.name")).value).toBe(GIT_USER_NAME);
    expect((await git.getConfig("user.email")).value).toBe(GIT_USER_EMAIL);
  });

  it("does not overwrite an existing local identity", async () => {
    const root = scratch();
    const git = simpleGit(root);
    await git.init();
    await git.addConfig("user.name", "existing");
    await git.addConfig("user.email", "existing@example.com");
    expect(await ensureGitRepository(root)).toBe(false);
    expect((await git.getConfig("user.name")).value).toBe("existing");
    expect((await git.getConfig("user.email")).value).toBe("existing@example.com");
  });
});
