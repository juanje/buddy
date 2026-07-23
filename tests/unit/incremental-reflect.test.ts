// tests/unit/incremental-reflect.test.ts — FR-REFLECT-03 checkpoint reflect.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { SpawnReflectOptions } from "../../backends/reflect-spawn";
import { SessionLifecycle } from "../../backends/session-lifecycle";
import { initTestGitRepo } from "../support/test-git";

describe("SessionLifecycle checkpoint reflect", () => {
  let dir: string;
  const spawns: SpawnReflectOptions[] = [];

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    spawns.length = 0;
  });

  function lifecycle(every: number): SessionLifecycle {
    return new SessionLifecycle({
      rootDir: dir,
      sessionId: "sess",
      sessionFile: "/tmp/fake-session.jsonl",
      incrementalEvery: every,
      spawnReflect: (options) => {
        spawns.push(options);
        return 1;
      },
    });
  }

  it("spawns checkpoint reflect on turn threshold", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-checkpoint-"));
    await initTestGitRepo(dir);
    const lc = lifecycle(2);

    await lc.handleEvent({
      type: "tool_execution_end",
      toolCall: { name: "write", args: { path: "user/inbox.md" } },
    });
    await lc.handleEvent({ type: "agent_end" });
    expect(spawns).toHaveLength(0);

    await lc.handleEvent({
      type: "tool_execution_end",
      toolCall: { name: "write", args: { path: "user/notes.md" } },
    });
    await lc.handleEvent({ type: "agent_end" });

    expect(spawns).toHaveLength(1);
    expect(spawns[0].mode).toBe("checkpoint");
    expect(spawns[0].forkedSessionFile).toBe("/tmp/fake-session.jsonl");
    expect(spawns[0].sessionId).toBe("sess");
    expect(spawns[0].checkpointDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(spawns[0].checkpointTime).toMatch(/^\d{2}:\d{2}$/);
    expect(lc.tracker.lastCheckpointTurn).toBe(2);
  });

  it("spawns checkpoint reflect on compaction_start", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-checkpoint-"));
    await initTestGitRepo(dir);
    const lc = lifecycle(99);

    await lc.handleEvent({
      type: "tool_execution_end",
      toolCall: { name: "write", args: { path: "user/inbox.md" } },
    });
    await lc.handleEvent({ type: "compaction_start" });

    expect(spawns).toHaveLength(1);
    expect(spawns[0].mode).toBe("checkpoint");
  });

  it("does not spawn checkpoint reflect without activity", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-checkpoint-"));
    await initTestGitRepo(dir);
    const lc = lifecycle(2);

    await lc.handleEvent({ type: "agent_end" });
    await lc.handleEvent({ type: "agent_end" });

    expect(spawns).toHaveLength(0);
  });
});
