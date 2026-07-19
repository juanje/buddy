// tests/unit/git.test.ts — FR-GIT-01 git helpers.

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";

import { buildCommitMessage, commitAll, hasUncommittedChanges } from "../../backends/git";

describe("buildCommitMessage", () => {
  it("summarizes one file", () => {
    expect(buildCommitMessage(["user/inbox.md"])).toBe("ab: update user/inbox.md");
  });

  it("summarizes many files", () => {
    const msg = buildCommitMessage(["a.md", "b.md", "c.md", "d.md"]);
    expect(msg).toBe("ab: update a.md, b.md, c.md (+1 more)");
  });
});

describe("commitAll", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("commits uncommitted changes", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-git-"));
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig("user.name", "AB");
    await git.addConfig("user.email", "ab@localhost");
    writeFileSync(join(dir, "note.md"), "hello");
    expect(await hasUncommittedChanges(dir)).toBe(true);
    const message = await commitAll(dir);
    expect(message).toBe("ab: update note.md");
    expect(await hasUncommittedChanges(dir)).toBe(false);
  });

  it("returns null when clean", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-git-"));
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig("user.name", "AB");
    await git.addConfig("user.email", "ab@localhost");
    writeFileSync(join(dir, "note.md"), "hello");
    await git.add(".");
    await git.commit("initial");
    expect(await commitAll(dir)).toBeNull();
  });
});
