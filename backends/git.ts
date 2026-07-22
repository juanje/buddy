// backends/git.ts — Git helpers for FR-GIT-01 (auto-commit) and FR-GIT-02 (invisible).

import { simpleGit, type SimpleGit } from "simple-git";

/** Build a descriptive commit message from changed file paths. */
export function buildCommitMessage(filePaths: string[]): string {
  if (filePaths.length === 0) return "ab: update files";
  if (filePaths.length === 1) return `ab: update ${filePaths[0]}`;
  if (filePaths.length <= 3) return `ab: update ${filePaths.join(", ")}`;
  return `ab: update ${filePaths.slice(0, 3).join(", ")} (+${filePaths.length - 3} more)`;
}

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
}
