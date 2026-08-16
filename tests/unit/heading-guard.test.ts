// tests/unit/heading-guard.test.ts — FR-GUARD-01 / FR-GUARD-01b: heading-snapshot guard.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createHeadingGuard } from "../../backends/heading-guard";

describe("heading guard", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function setup(): ReturnType<typeof createHeadingGuard> {
    dir = mkdtempSync(join(tmpdir(), "buddy-hguard-"));
    return createHeadingGuard(dir);
  }

  it("reverts a write that removes a heading", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "observations.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    const original = "## Patterns\n\nSome patterns.\n\n## One-off\n\nStuff.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "## One-off\n\nStuff.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(true);
    expect(result.lostHeadings).toEqual(["Patterns"]);
    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("allows a write that preserves all headings", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "concepts", "test.md");
    mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
    const original = "## Summary\n\nOld content.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "## Summary\n\nUpdated content.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("allows adding new headings", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "test.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    writeFileSync(filePath, "## A\n\nContent.\n", "utf8");

    guard.capture(filePath);
    const newContent = "## A\n\nContent.\n\n## B\n\nNew section.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("does not guard files outside the protected list", () => {
    const guard = setup();
    const filePath = join(dir, "user", "notes.md");
    mkdirSync(join(dir, "user"), { recursive: true });
    const original = "## Ideas\n\nStuff.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "No headings at all.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe("No headings at all.\n");
  });

  it("allows restructuring agent_brain/projects/ files", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "projects", "buddy", "bugs.md");
    mkdirSync(join(dir, "agent_brain", "projects", "buddy"), { recursive: true });
    const original = "## BUG-01\n\nFirst.\n\n## BUG-02\n\nSecond.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "## BUG-01\n\nFirst.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("allows restructuring agent_brain/concepts/ (non-index) files", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "concepts", "some-concept.md");
    mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
    const original = "## Summary\n\nOld.\n\n## Examples\n\nMore.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "## Summary\n\nOld.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("allows restructuring agent_brain/skills/ files", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "skills", "process-conversation.md");
    mkdirSync(join(dir, "agent_brain", "skills"), { recursive: true });
    const original = "## Procedure\n\nSteps.\n\n## Quality\n\nChecks.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "## Procedure\n\nSteps.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("allows restructuring agent_brain/ideas/ (non-index) files", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "ideas", "2026-08-16_test-idea.md");
    mkdirSync(join(dir, "agent_brain", "ideas"), { recursive: true });
    const original = "## Core idea\n\nSeed.\n\n## Notes\n\nMore.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "## Core idea\n\nSeed.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("allows restructuring agent_brain/identity/ files other than USER.md and SOUL.md", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "identity", "family.md");
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    const original = "## Context\n\nFamily.\n\n## Care\n\nNotes.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "## Context\n\nFamily.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("allows restructuring logs/archive/ files", () => {
    const guard = setup();
    const filePath = join(dir, "logs", "archive", "2026-07", "2026-07-08.md");
    mkdirSync(join(dir, "logs", "archive", "2026-07"), { recursive: true });
    const original = "## Day summary\n\nContent.\n\n## Lessons\n\nLearned.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "## Day summary\n\nContent.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("still guards AGENTS.md at root", () => {
    const guard = setup();
    const filePath = join(dir, "AGENTS.md");
    const original = "## Active context\n\nHot.\n\n## Where to find things\n\nMap.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "## Where to find things\n\nMap.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(true);
    expect(result.lostHeadings).toEqual(["Active context"]);
    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("still guards user/inbox.md", () => {
    const guard = setup();
    const filePath = join(dir, "user", "inbox.md");
    mkdirSync(join(dir, "user"), { recursive: true });
    const original = "## Capture\n\nIn.\n\n## Next Actions\n\nDo.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "## Next Actions\n\nDo.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(true);
    expect(result.lostHeadings).toEqual(["Capture"]);
    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("guards log files", () => {
    const guard = setup();
    const filePath = join(dir, "logs", "2026-08-01.md");
    mkdirSync(join(dir, "logs"), { recursive: true });
    const original = "## Session 10:00–11:00\n\nLog content.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "Destroyed.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(true);
    expect(result.lostHeadings).toContain("Session 10:00–11:00");
    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("consumes the snapshot on check (one capture, one check)", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "observations.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    writeFileSync(filePath, "## A\n\nContent.\n", "utf8");

    guard.capture(filePath);
    // First check consumes the snapshot
    guard.check(filePath);
    // Second check without capture — no snapshot, no revert
    writeFileSync(filePath, "No headings.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
  });

  it("handles files with no headings before the write", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "test.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    writeFileSync(filePath, "Just text, no headings.\n", "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "## New Heading\n\nNew content.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
  });

  it("reverts a write that removes an h1 heading", () => {
    const guard = setup();
    const filePath = join(dir, "logs", "2026-08-05.md");
    mkdirSync(join(dir, "logs"), { recursive: true });
    const original = "---\ndate: 2026-08-05\n---\n\n# Log — 2026-08-05\n\n## Day summary\n\nContent.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "---\ndate: 2026-08-05\n---\n\n## Day summary\n\nContent.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(true);
    expect(result.lostHeadings).toContain("Log — 2026-08-05");
    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("reverts a write that strips frontmatter", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "deferred.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    const original = "---\nsummary: deferred items\n---\n\n## Queue\n\nItems.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    writeFileSync(filePath, "## Queue\n\nItems.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(true);
    expect(readFileSync(filePath, "utf8")).toBe(original);
  });

  it("allows a write that preserves frontmatter", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "deferred.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    const original = "---\nsummary: deferred items\n---\n\n## Queue\n\nItems.\n";
    writeFileSync(filePath, original, "utf8");

    guard.capture(filePath);
    const newContent = "---\nsummary: deferred items\nupdated: 2026-08-06\n---\n\n## Queue\n\nMore items.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(newContent);
  });

  it("does not trigger frontmatter guard when file had no frontmatter", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "test.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    writeFileSync(filePath, "## Summary\n\nContent.\n", "utf8");

    guard.capture(filePath);
    const newContent = "## Summary\n\nUpdated content.\n";
    writeFileSync(filePath, newContent, "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
  });

  it("does not guard files that do not exist at capture time", () => {
    const guard = setup();
    const filePath = join(dir, "agent_brain", "new-file.md");
    mkdirSync(join(dir, "agent_brain"), { recursive: true });

    guard.capture(filePath);
    writeFileSync(filePath, "## Created\n\nContent.\n", "utf8");
    const result = guard.check(filePath);

    expect(result.reverted).toBe(false);
  });
});
