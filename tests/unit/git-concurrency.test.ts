// tests/unit/git-concurrency.test.ts — FR-REFLECT-06.
//
// The race is between processes: the reflect child commits the agent's writes
// from its own process while the worker auto-commits on its own schedule. Both
// run `git add -A`, and staging is global to the repo, so whichever loses the
// race for .git/index.lock throws. In the child that meant a non-zero exit and
// the loss of the whole session summary.
//
// Verified against the pre-H6 implementation (no lock): children failed with
// "index.lock" errors. If this ever passes trivially, check the children really
// are concurrent.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { initTestGitRepo } from "../support/test-git";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const COMMITTERS = 4;
const COMMITS_EACH = 4;

let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "git-concurrency-"));
  await initTestGitRepo(dir);
  // Deliberately no .gitignore: the lock must live outside the repo, so this
  // must pass even for an imported instance that never had one.
  writeFileSync(join(dir, "seed.txt"), "seed\n");
  const { simpleGit } = await import("simple-git");
  await simpleGit(dir).add("-A").commit("seed");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeCommitterScript(): string {
  const scriptPath = join(dir, "committer.ts");
  writeFileSync(
    scriptPath,
    `
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitAll } from ${JSON.stringify(join(REPO_ROOT, "backends", "git.ts"))};

// Wrapped: a .ts file in a directory without package.json is treated as CJS,
// where top-level await is unavailable.
async function main() {
  const [rootDir, id, count] = process.argv.slice(2);
  for (let i = 0; i < Number(count); i++) {
    writeFileSync(join(rootDir, \`file-\${id}-\${i}.txt\`), String(i), "utf8");
    await commitAll(rootDir, \`writer \${id} commit \${i}\`);
  }
}
main().catch((err) => { console.error(err); process.exit(1); });
`,
    "utf8",
  );
  return scriptPath;
}

function runCommitter(scriptPath: string, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", scriptPath, dir, String(id), String(COMMITS_EACH)],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`committer ${id} exited ${code}: ${stderr}`));
    });
  });
}

describe("commitAll under concurrent processes", () => {
  it(
    "does not fail when separate processes commit at once",
    async () => {
      const scriptPath = writeCommitterScript();

      // Each child must exit 0. Before H6 they died on .git/index.lock, which
      // in the reflect child meant the session summary was never written.
      await Promise.all(
        Array.from({ length: COMMITTERS }, (_, id) => runCommitter(scriptPath, id)),
      );

      const { simpleGit } = await import("simple-git");
      const git = simpleGit(dir);
      const status = await git.status();
      expect(status.isClean(), "every change should have been committed").toBe(true);

      // Nothing is lost: each writer's files are all tracked.
      const tracked = (await git.raw(["ls-files"])).split("\n").filter(Boolean);
      for (let id = 0; id < COMMITTERS; id++) {
        for (let i = 0; i < COMMITS_EACH; i++) {
          expect(tracked, `file-${id}-${i}.txt should be committed`).toContain(
            `file-${id}-${i}.txt`,
          );
        }
      }
    },
    60_000,
  );
});
