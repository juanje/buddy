// tests/unit/incremental-reflect.test.ts — FR-REFLECT-03 incremental snapshots.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { saveIncrementalSnapshot } from "../../backends/reflect";
import { SessionLifecycle } from "../../backends/session-lifecycle";
import { initTestGitRepo } from "../support/test-git";

describe("SessionLifecycle incremental reflect", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("writes snapshot on turn threshold", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-incr-"));
    await initTestGitRepo(dir);
    const lifecycle = new SessionLifecycle({
      abDirectory: dir,
      sessionId: "sess",
      incrementalEvery: 2,
    });

    await lifecycle.handleEvent({
      type: "tool_execution_end",
      toolCall: { name: "write", args: { path: "user/inbox.md" } },
    });
    await lifecycle.handleEvent({ type: "agent_end" });
    expect(existsSync(join(dir, ".ab-app", "snapshots"))).toBe(false);

    await lifecycle.handleEvent({
      type: "tool_execution_end",
      toolCall: { name: "write", args: { path: "user/notes.md" } },
    });
    await lifecycle.handleEvent({ type: "agent_end" });

    const snapDir = join(dir, ".ab-app", "snapshots");
    expect(existsSync(snapDir)).toBe(true);
    const file = readFileSync(join(snapDir, "sess_2.md"), "utf8");
    expect(file).toContain("user/notes.md");
  });

  it("writes snapshot on compaction_start", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-compact-"));
    await initTestGitRepo(dir);
    const lifecycle = new SessionLifecycle({
      abDirectory: dir,
      sessionId: "sess",
      incrementalEvery: 99,
    });

    await lifecycle.handleEvent({
      type: "tool_execution_end",
      toolCall: { name: "write", args: { path: "user/inbox.md" } },
    });
    await lifecycle.handleEvent({ type: "compaction_start" });

    expect(existsSync(join(dir, ".ab-app", "snapshots", "sess_0.md"))).toBe(true);
  });
});

describe("saveIncrementalSnapshot", () => {
  it("formats segment body", () => {
    const dir = mkdtempSync(join(tmpdir(), "ab-snap-"));
    const path = saveIncrementalSnapshot(
      dir,
      "sess",
      5,
      {
        filesRead: [],
        filesWritten: ["user/a.md"],
        toolCalls: [],
        startTurn: 1,
        endTurn: 5,
      },
      "### Notes\nCaptured.",
    );
    const content = readFileSync(path, "utf8");
    expect(content).toContain("turns 1-5");
    expect(content).toContain("user/a.md");
    expect(content).toContain("Captured.");
    rmSync(dir, { recursive: true, force: true });
  });
});
