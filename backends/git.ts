// backends/git.ts — Git helpers for FR-GIT-01 (auto-commit) and FR-GIT-02 (invisible).

import { createHash } from "node:crypto";
import { join } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";

import { GIT_COMMIT_PREFIX, GIT_LOCK_TIMEOUT_MS } from "../shared/defaults";
import { globalConfigDir } from "./global-config";
import { withFileLock } from "./state-file";

/**
 * Lock name for serializing repo access, kept in ~/.buddy/locks/ rather than
 * inside the repo.
 *
 * A lock under the buddy directory would be staged by the very `git add -A` it
 * guards unless `.buddy/` is gitignored — which the app cannot guarantee, since
 * FR-SETUP-10 adopts an existing directory without modifying its content. The
 * pre-existing git tests caught exactly that: commits named
 * "update .buddy/.git.lock". Keying by rootDir keeps separate instances from
 * sharing a lock.
 */
function gitLockResource(rootDir: string): string {
  const key = createHash("sha256").update(rootDir).digest("hex").slice(0, 16);
  return join(globalConfigDir(), "locks", `${key}.git`);
}

/** Build a descriptive commit message from changed file paths. */
export function buildCommitMessage(filePaths: string[]): string {
  if (filePaths.length === 0) return `${GIT_COMMIT_PREFIX} update files`;
  if (filePaths.length === 1) return `${GIT_COMMIT_PREFIX} update ${filePaths[0]}`;
  if (filePaths.length <= 3) return `${GIT_COMMIT_PREFIX} update ${filePaths.join(", ")}`;
  return `${GIT_COMMIT_PREFIX} update ${filePaths.slice(0, 3).join(", ")} (+${filePaths.length - 3} more)`;
}

/**
 * Git client for auto-commit and file tools.
 *
 * simple-git already passes `windowsHide: true` on every spawn (NFR-PORT-09) —
 * do not re-inject `process.env` via `.env()` (that trips simple-git's unsafe
 * EDITOR/GIT_PAGER guards when the host shell exports those vars).
 */
export function gitClient(rootDir: string): SimpleGit {
  return simpleGit(rootDir);
}

export async function hasUncommittedChanges(rootDir: string): Promise<boolean> {
  const status = await gitClient(rootDir).status();
  return !status.isClean();
}

/**
 * Stage all changes and commit. Returns the commit message, or null if nothing to commit.
 */
export async function commitAll(
  rootDir: string,
  summary?: string,
): Promise<string | null> {
  // FR-REFLECT-06: exclusive across processes. The reflect child commits the
  // agent's writes from its own process while the worker auto-commits on its
  // own schedule; both run `git add -A`, and whichever loses the race for
  // `.git/index.lock` throws. In the child that propagated to a non-zero exit,
  // losing the entire session summary — silent memory loss with no attacker
  // involved. Staging is global to the repo, so the whole stage-and-commit has
  // to be exclusive, not just the commit.
  return withFileLock(
    gitLockResource(rootDir),
    async () => {
      const git = gitClient(rootDir);
      const status = await git.status();
      if (status.isClean()) return null;

      await git.add("-A");
      const staged = await git.diff(["--cached", "--name-only"]);
      const paths = staged
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);
      const message = summary ?? buildCommitMessage(paths);
      await git.commit(message);
      return message;
    },
    GIT_LOCK_TIMEOUT_MS,
  );
}
