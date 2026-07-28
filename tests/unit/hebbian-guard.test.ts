// tests/unit/hebbian-guard.test.ts — FR-HEBB-06.
//
// AGENTS.md tells the agent: "do not update frontmatter fields manually …
// never edit these fields on existing files". Nothing enforced it.
//
// Observed 2026-07-29. A local model failed eight consecutive `edit` calls
// (it kept dropping Markdown bold markers from `oldText`), gave up, and
// rewrote `user/inbox.md` whole. The rewrite reproduced the frontmatter from
// memory:
//
//     -access_count: 7
//     +access_count: 1
//
// Seven sessions of accumulated Hebbian signal destroyed, in a diff that looks
// like a plausible metadata bump. Nothing in the commit, the log or the UI
// distinguished it from a normal edit.
//
// The counters are worker-owned by design (FR-HEBB-01/05): the model reads
// them to decide promotion but must never write them. This makes that true
// rather than merely instructed — a whole-file rewrite is exactly the case a
// rule cannot cover, because the model is not editing the fields, it is
// regenerating the file that happens to contain them.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createHebbianGuard } from "../../backends/hebbian-guard";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hebbian-guard-"));
  mkdirSync(join(root, "agent_brain", "concepts"), { recursive: true });
  mkdirSync(join(root, "user"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const ORIGINAL = `---
summary: A concept
created: 2026-05-08
last_accessed: 2026-07-26
access_count: 7
---

# Body
`;

function write(rel: string, content: string): void {
  writeFileSync(join(root, rel), content, "utf8");
}

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("createHebbianGuard", () => {
  it("restores counters a whole-file rewrite reset", () => {
    const rel = "user/inbox.md";
    write(rel, ORIGINAL);
    const guard = createHebbianGuard(root);

    guard.capture(rel);
    // What the model actually did: rewrote the file, frontmatter from memory.
    write(rel, ORIGINAL.replace("last_accessed: 2026-07-26", "last_accessed: 2026-07-29").replace("access_count: 7", "access_count: 1"));
    expect(guard.restore(rel)).toBe(true);

    expect(read(rel)).toContain("access_count: 7");
    expect(read(rel)).toContain("last_accessed: 2026-07-26");
  });

  it("keeps the body and every other key the rewrite intended", () => {
    // The write is legitimate apart from the counters; only those come back.
    const rel = "user/inbox.md";
    write(rel, ORIGINAL);
    const guard = createHebbianGuard(root);

    guard.capture(rel);
    write(rel, ORIGINAL.replace("access_count: 7", "access_count: 1").replace("# Body", "# Rewritten body"));
    guard.restore(rel);

    expect(read(rel)).toContain("# Rewritten body");
    expect(read(rel)).toContain("summary: A concept");
    expect(read(rel)).toContain("access_count: 7");
  });

  it("does nothing when the rewrite left the counters alone", () => {
    const rel = "user/inbox.md";
    write(rel, ORIGINAL);
    const guard = createHebbianGuard(root);

    guard.capture(rel);
    write(rel, ORIGINAL.replace("# Body", "# Edited"));
    expect(guard.restore(rel)).toBe(false);
    expect(read(rel)).toContain("# Edited");
  });

  it("does not resurrect counters into a file that no longer has frontmatter", () => {
    // Deliberately rewriting a file without frontmatter is a content decision;
    // re-inserting a block would be the guard inventing structure.
    const rel = "user/inbox.md";
    write(rel, ORIGINAL);
    const guard = createHebbianGuard(root);

    guard.capture(rel);
    write(rel, "# Just a heading\n");
    expect(guard.restore(rel)).toBe(false);
    expect(read(rel)).toBe("# Just a heading\n");
  });

  it("is a no-op for a file created during the turn", () => {
    // Nothing was captured, so there is nothing to restore and no basis to
    // claim the counters are wrong.
    const guard = createHebbianGuard(root);
    guard.capture("user/new.md"); // does not exist yet
    write("user/new.md", ORIGINAL.replace("access_count: 7", "access_count: 1"));

    expect(guard.restore("user/new.md")).toBe(false);
    expect(read("user/new.md")).toContain("access_count: 1");
  });

  it("restores only the file it captured", () => {
    write("user/a.md", ORIGINAL);
    write("user/b.md", ORIGINAL);
    const guard = createHebbianGuard(root);

    guard.capture("user/a.md");
    write("user/a.md", ORIGINAL.replace("access_count: 7", "access_count: 1"));
    write("user/b.md", ORIGINAL.replace("access_count: 7", "access_count: 2"));
    guard.restore("user/a.md");

    expect(read("user/a.md")).toContain("access_count: 7");
    expect(read("user/b.md")).toContain("access_count: 2"); // untouched
  });

  it("forgets a capture once restored, so a later write is judged fresh", () => {
    const rel = "user/inbox.md";
    write(rel, ORIGINAL);
    const guard = createHebbianGuard(root);

    guard.capture(rel);
    write(rel, ORIGINAL.replace("access_count: 7", "access_count: 1"));
    guard.restore(rel);

    // A second write with no capture must not be reverted to a stale value.
    write(rel, ORIGINAL.replace("access_count: 7", "access_count: 9"));
    expect(guard.restore(rel)).toBe(false);
    expect(read(rel)).toContain("access_count: 9");
  });
});

// ---------------------------------------------------------------------------
// The wiring. The guard is inert unless the lifecycle drives it, and a guard
// nobody calls looks exactly like a guard that works.
// ---------------------------------------------------------------------------

describe("the session lifecycle drives the guard", () => {
  const source = readFileSync(
    join(import.meta.dirname, "..", "..", "backends", "session-lifecycle.ts"),
    "utf8",
  ).replace(/^\s*\/\/.*$/gm, "");

  it("captures before a write or edit runs", () => {
    expect(source).toMatch(/tool_execution_start[\s\S]{0,300}hebbianGuard\.capture\(/);
  });

  it("restores after it finishes", () => {
    expect(source).toMatch(/tool_execution_end[\s\S]{0,600}hebbianGuard\.restore\(/);
  });

  it("does not restore after a failed tool call", () => {
    // A failed write did not change the file; "repairing" it would write a
    // stale value over whatever is actually there.
    expect(source).toMatch(/isError !== true[\s\S]{0,120}hebbianGuard\.restore\(/);
  });
});
