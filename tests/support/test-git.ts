import { simpleGit } from "simple-git";

export async function initTestGitRepo(dir: string): Promise<void> {
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.name", "AB");
  await git.addConfig("user.email", "ab@localhost");
}
