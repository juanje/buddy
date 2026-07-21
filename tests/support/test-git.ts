import { simpleGit } from "simple-git";

import { GIT_USER_EMAIL, GIT_USER_NAME } from "../../shared/defaults";

export async function initTestGitRepo(dir: string): Promise<void> {
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.name", GIT_USER_NAME);
  await git.addConfig("user.email", GIT_USER_EMAIL);
}
