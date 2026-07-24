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

  function lifecycle(): SessionLifecycle {
    return new SessionLifecycle({
      rootDir: dir,
      sessionId: "sess",
      sessionFile: "/tmp/fake-session.jsonl",
      spawnReflect: (options) => {
        spawns.push(options);
        return 1;
      },
    });
  }

  it("spawns checkpoint reflect on compaction_start", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-checkpoint-"));
    await initTestGitRepo(dir);
    const lc = lifecycle();

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
    const lc = lifecycle();

    await lc.handleEvent({ type: "agent_end" });
    await lc.handleEvent({ type: "agent_end" });

    expect(spawns).toHaveLength(0);
  });

  it("does not spawn checkpoint reflect on turn count alone", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-checkpoint-"));
    await initTestGitRepo(dir);
    const lc = lifecycle();

    for (let i = 0; i < 20; i++) {
      await lc.handleEvent({
        type: "tool_execution_end",
        toolCall: { name: "write", args: { path: `user/turn-${i}.md` } },
      });
      await lc.handleEvent({ type: "agent_end" });
    }

    expect(spawns).toHaveLength(0);
  });

  it("does not spawn checkpoint reflect on compaction without activity", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-checkpoint-"));
    await initTestGitRepo(dir);
    const lc = lifecycle();

    await lc.handleEvent({ type: "compaction_start" });

    expect(spawns).toHaveLength(0);
  });
});
