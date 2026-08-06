// tests/unit/heading-guard.test.ts — FR-GUARD-01: heading-snapshot guard.

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

  it("does not guard files outside agent_brain and logs", () => {
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
    const filePath = join(dir, "agent_brain", "test.md");
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
