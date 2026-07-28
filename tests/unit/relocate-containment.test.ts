// tests/unit/relocate-containment.test.ts — NFR-SEC-16.
//
// `relocate_brain_file` was the fourth place containment was decided, and the
// only one that got it wrong. Its rule was a string test:
//
//     if (!src.startsWith("agent_brain/")) throw …
//
// `agent_brain/../.pi/settings.json` satisfies that. join() then collapses the
// `..`, and the tool git-mv's a file the permission layer explicitly protects
// (NFR-SEC-06 refuses writes to .pi/settings.json). The destination side is
// worse: it mkdir's and moves to an arbitrary location on disk.
//
// The tool runs inside the maintenance session, whose gate answers "deny" to
// everything outside the buddy directory (FR-CONSOL-10) — but the gate inspects
// `path`, and this tool takes `source`/`destination`, so it never saw these.
// That is the same gap NFR-SEC-13 closes from the other end.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { simpleGit } from "simple-git";

import { relocateBrainFile, RelocateBrainFileError } from "../../backends/consolidation-relocate";
import { initTestGitRepo } from "../support/test-git";

let base: string;
let root: string;

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), "relocate-containment-"));
  root = join(base, "buddy");
  mkdirSync(join(root, "agent_brain", "notes"), { recursive: true });
  mkdirSync(join(root, ".pi"), { recursive: true });
  writeFileSync(join(root, "agent_brain", "notes", "a.md"), "# a\n");
  writeFileSync(join(root, ".pi", "settings.json"), '{"defaultModel":"real"}\n');
  await initTestGitRepo(root);
  // Everything is committed, including .pi/settings.json. Without that, `git mv`
  // refuses the traversal for its own reasons ("not under version control") and
  // the test would report a containment check that does not exist.
  await simpleGit(root).add("-A");
  await simpleGit(root).commit("fixture");
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("relocateBrainFile containment", () => {
  it("moves a file within agent_brain/", async () => {
    await relocateBrainFile(root, "agent_brain/notes/a.md", "agent_brain/archive/a.md");
    expect(existsSync(join(root, "agent_brain", "archive", "a.md"))).toBe(true);
  });

  it("refuses a source that walks out of agent_brain/ with ..", async () => {
    await expect(
      relocateBrainFile(root, "agent_brain/../.pi/settings.json", "agent_brain/settings.json"),
    ).rejects.toThrow(RelocateBrainFileError);

    // The protected config is still where it was, with its contents intact.
    expect(existsSync(join(root, ".pi", "settings.json"))).toBe(true);
  });

  it("refuses a destination that leaves the buddy directory", async () => {
    const escaped = join(base, "stolen");
    await expect(
      relocateBrainFile(root, "agent_brain/notes/a.md", `agent_brain/../../stolen/a.md`),
    ).rejects.toThrow(RelocateBrainFileError);

    expect(existsSync(escaped)).toBe(false);
    expect(existsSync(join(root, "agent_brain", "notes", "a.md"))).toBe(true);
  });

  it("refuses an absolute path dressed up as a relative one", async () => {
    await expect(
      relocateBrainFile(root, "agent_brain/notes/a.md", "/tmp/agent_brain/a.md"),
    ).rejects.toThrow(RelocateBrainFileError);
  });
});
