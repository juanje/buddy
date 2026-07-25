// tests/unit/hebbian.test.ts — FR-HEBB Hebbian access tracking.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHebbianTracker } from "../../backends/hebbian";
import { toIsoDay } from "../../shared/dates";

function brainFile(content: string): string {
  return content;
}

describe("createHebbianTracker", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  function setupAb(): string {
    dir = mkdtempSync(join(tmpdir(), "ab-hebb-"));
    mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    mkdirSync(join(dir, "agent_brain", "skills"), { recursive: true });
    mkdirSync(join(dir, "user"), { recursive: true });
    return dir;
  }

  it("queues a brain file with access_count frontmatter", () => {
    const ab = setupAb();
    const rel = "agent_brain/concepts/example.md";
    writeFileSync(
      join(ab, rel),
      brainFile("---\naccess_count: 2\nlast_accessed: 2026-01-01\n---\n\nBody\n"),
      "utf8",
    );

    const tracker = createHebbianTracker(ab);
    tracker.trackAccess(rel);
    expect(tracker.flush()).toBe(true);

    const updated = readFileSync(join(ab, rel), "utf8");
    expect(updated).toContain("access_count: 3");
    expect(updated).toContain(`last_accessed: ${toIsoDay(new Date())}`);
    expect(updated).toContain("\nBody\n");
  });

  it("ignores files without access_count in frontmatter", () => {
    const ab = setupAb();
    const rel = "agent_brain/concepts/no-meta.md";
    const original = "---\ntitle: x\n---\n\nBody\n";
    writeFileSync(join(ab, rel), original, "utf8");

    const tracker = createHebbianTracker(ab);
    tracker.trackAccess(rel);
    expect(tracker.flush()).toBe(false);
    expect(readFileSync(join(ab, rel), "utf8")).toBe(original);
  });

  it("deduplicates the same file read twice in one session", () => {
    const ab = setupAb();
    const rel = "agent_brain/concepts/dedup.md";
    writeFileSync(join(ab, rel), "---\naccess_count: 1\n---\n\nBody\n", "utf8");

    const tracker = createHebbianTracker(ab);
    tracker.trackAccess(rel);
    tracker.trackAccess(rel);
    tracker.flush();

    const updated = readFileSync(join(ab, rel), "utf8");
    expect(updated).toContain("access_count: 2");
  });

  it("never tracks excluded structural files", () => {
    const ab = setupAb();
    const cases = [
      "agent_brain/identity/SOUL.md",
      "agent_brain/identity/USER.md",
      "agent_brain/observations.md",
      "agent_brain/deferred.md",
      "agent_brain/concepts/index.md",
      "agent_brain/skills/process-conversation.md",
    ];

    for (const rel of cases) {
      mkdirSync(dirname(join(ab, rel)), { recursive: true });
      writeFileSync(join(ab, rel), "---\naccess_count: 1\n---\n\nBody\n", "utf8");
    }

    const tracker = createHebbianTracker(ab);
    for (const rel of cases) tracker.trackAccess(rel);
    expect(tracker.flush()).toBe(false);

    for (const rel of cases) {
      expect(readFileSync(join(ab, rel), "utf8")).toContain("access_count: 1");
    }
  });

  it("never tracks files outside agent_brain", () => {
    const ab = setupAb();
    const rel = "user/inbox.md";
    writeFileSync(join(ab, rel), "---\naccess_count: 1\n---\n\nBody\n", "utf8");

    const tracker = createHebbianTracker(ab);
    tracker.trackAccess(rel);
    expect(tracker.flush()).toBe(false);
    expect(readFileSync(join(ab, rel), "utf8")).toContain("access_count: 1");
  });

  it("reads fresh content at flush time after LLM edits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00Z"));

    const ab = setupAb();
    const rel = "agent_brain/concepts/race.md";
    writeFileSync(join(ab, rel), "---\naccess_count: 4\n---\n\nOriginal\n", "utf8");

    const tracker = createHebbianTracker(ab);
    tracker.trackAccess(rel);
    writeFileSync(join(ab, rel), "---\naccess_count: 4\n---\n\nEdited by LLM\n", "utf8");
    tracker.flush();

    const updated = readFileSync(join(ab, rel), "utf8");
    expect(updated).toContain("access_count: 5");
    expect(updated).toContain("last_accessed: 2026-07-21");
    expect(updated).toContain("Edited by LLM");
  });

  it("accepts absolute paths under the buddy directory", () => {
    const ab = setupAb();
    const rel = "agent_brain/concepts/abs.md";
    writeFileSync(join(ab, rel), "---\naccess_count: 0\n---\n\nBody\n", "utf8");

    const tracker = createHebbianTracker(ab);
    tracker.trackAccess(join(ab, rel));
    tracker.flush();

    expect(readFileSync(join(ab, rel), "utf8")).toContain("access_count: 1");
  });
});
