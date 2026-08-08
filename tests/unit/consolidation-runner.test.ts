// tests/unit/consolidation-runner.test.ts — FR-CONSOL-03/04/06 runner behavior.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildConsolidationPrompt,
  runConsolidation,
  type MaintenanceSessionLike,
} from "../../backends/consolidation-runner";
import { acquireLock, releaseLock } from "../../backends/maintenance";
import { initTestGitRepo } from "../support/test-git";
import { depthFailureCount, loadConsolidationLog, loadConsolidationState } from "../../shared/consolidation-state";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

describe("consolidation runner", () => {
  let dir: string;
  let globalConfigDir: string | undefined;

  afterEach(() => {
    if (dir) {
      releaseLock(dir);
      rmSync(dir, { recursive: true, force: true });
    }
    teardownGlobalConfigDir(globalConfigDir, vi);
    globalConfigDir = undefined;
  });

  function setupBuddyDir(): void {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir({
      consolidationSkill: "# Skill\n\nDo consolidation.\n",
    }, vi));
    dir = mkdtempSync(join(tmpdir(), "buddy-consol-run-"));
    writeFileSync(join(dir, "AGENTS.md"), "# Rules\n");
    writeFileSync(join(dir, "notes.txt"), "hello\n");
  }

  it("builds consolidation prompt from the global skill file", () => {
    setupBuddyDir();
    const prompt = buildConsolidationPrompt(dir, 1, new Date("2026-07-22T12:00:00Z"));
    expect(prompt).toContain("Date:");
    expect(prompt).toContain("Run consolidation at depth 1");
    expect(prompt).toContain("Do consolidation.");
    expect(prompt).toContain("Do not run git commands");
    expect(prompt).toContain("Hebbian promotion data (pre-computed):");
    expect(prompt).toContain("Upcoming items (within 24h of run date):");
    expect(prompt).toContain("Ripe observations (Step 7 — act on each):");
  });

  it("includes brain health block when issues exist", () => {
    setupBuddyDir();
    mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
    writeFileSync(join(dir, "agent_brain", "concepts", "stale.md"), "# Missing frontmatter\n");

    const prompt = buildConsolidationPrompt(dir, 1, new Date("2026-07-22T12:00:00Z"));
    expect(prompt).toContain("Brain health (pre-computed):");
    expect(prompt).toContain("agent_brain/concepts/stale.md");
  });

  it("omits brain health block when brain is healthy", () => {
    setupBuddyDir();
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    writeFileSync(
      join(dir, "agent_brain", "identity", "SOUL.md"),
      "---\nsummary: Agent character\ncreated: 2026-07-01\n---\n\n# Soul\n",
    );
    writeFileSync(
      join(dir, "agent_brain", "identity", "USER.md"),
      "---\nsummary: User profile\ncreated: 2026-07-01\n---\n\n# User\n",
    );
    writeFileSync(
      join(dir, "agent_brain", "deferred.md"),
      "---\nsummary: Deferred queue\ncreated: 2026-07-01\n---\n\n# Deferred\n",
    );
    writeFileSync(
      join(dir, "agent_brain", "observations.md"),
      "---\nsummary: Observations\ncreated: 2026-07-01\n---\n\n# Observations\n",
    );

    const prompt = buildConsolidationPrompt(dir, 1, new Date("2026-07-22T12:00:00Z"));
    expect(prompt).not.toContain("Brain health (pre-computed):");
  });

  it("runs cascade depths, commits, and advances counters", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "v1\n");
    const { simpleGit } = await import("simple-git");
    await simpleGit(dir).add("-A").commit("seed");

    const prompt = vi.fn(async () => {});
    const dispose = vi.fn();
    const createSession = vi.fn(async (): Promise<MaintenanceSessionLike> => ({
      prompt,
      dispose,
    }));

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;
    state.depth1RunsSinceLastDepth2 = 5;

    const result = await runConsolidation({
      rootDir: dir,
      targetDepth: 2,
      modelRuntime: {} as never,
      state,
      createSession,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(result.ran).toBe(true);
    expect(result.completedDepths).toEqual([1, 2]);
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(loadConsolidationState(dir).lastDepth2).toBe("2026-07-22T12:00:00.000Z");

    const log = loadConsolidationLog(dir);
    expect(log).toHaveLength(2);
    expect(log.every((entry) => entry.status === "success")).toBe(true);
  });

  it("commits once per consolidation cycle including maintenance log entry", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "v1\n");
    const { simpleGit } = await import("simple-git");
    const git = simpleGit(dir);
    await git.add("-A").commit("seed");
    const commitsBefore = (await git.log()).total;

    const createSession = vi.fn(async (): Promise<MaintenanceSessionLike> => ({
      prompt: async () => {},
      dispose: () => {},
    }));

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;

    const result = await runConsolidation({
      rootDir: dir,
      targetDepth: 1,
      modelRuntime: {} as never,
      state,
      createSession,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(result.ran).toBe(true);
    const commitsAfter = (await git.log()).total;
    expect(commitsAfter - commitsBefore).toBe(1);

    const latest = (await git.log({ maxCount: 1 })).latest;
    expect(latest?.message).toBe("daily: 2026-07-22");
  });

  // FR-CONSOL-14. This used to assert the daily log always gained
  // "Maintenance cycle completed: depth-1." — a line saying only that the
  // machinery ran, written into a file re-injected into every future session.
  // It was also what made the 22 ms phantom run of 2026-07-28 look legitimate,
  // since it was emitted without reference to whether any work had happened.
  it("writes no maintenance note when there is nothing to report", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);
    const { simpleGit } = await import("simple-git");
    await simpleGit(dir).add("-A").commit("seed");

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;

    await runConsolidation({
      rootDir: dir,
      targetDepth: 1,
      modelRuntime: {} as never,
      state,
      createSession: async () => ({ prompt: async () => {}, dispose: () => {} }),
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(existsSync(join(dir, "logs", "2026-07-22.md"))).toBe(false);
  });

  it("writes the note when the run changed identity or refused a path", async () => {
    // The notes that matter are still delivered — and now they arrive without
    // routine noise around them, so they are visible.
    setupBuddyDir();
    await initTestGitRepo(dir);
    const { simpleGit } = await import("simple-git");
    await simpleGit(dir).add("-A").commit("seed");

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;

    await runConsolidation({
      rootDir: dir,
      targetDepth: 1,
      modelRuntime: {} as never,
      state,
      createSession: async () => ({
        prompt: async () => {},
        dispose: () => {},
        changedIdentity: () => true,
        refusedPaths: () => ["/etc/passwd"],
      }),
      now: new Date("2026-07-22T12:00:00Z"),
    });

    const log = readFileSync(join(dir, "logs", "2026-07-22.md"), "utf8");
    expect(log).toContain("Updated SOUL.md");
    expect(log).toContain("/etc/passwd");
    expect(log).toContain("Maintenance cycle: depth-1."); // context for the notes
  });

  it("defers when maintenance lock is held", async () => {
    setupBuddyDir();
    acquireLock(dir);
    const createSession = vi.fn();

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;

    const result = await runConsolidation({
      rootDir: dir,
      targetDepth: 1,
      modelRuntime: {} as never,
      state,
      createSession,
    });

    expect(result.ran).toBe(false);
    expect(createSession).not.toHaveBeenCalled();
    expect(existsSync(join(dir, ".buddy", "consolidation-log.json"))).toBe(false);
  });

  // Rewritten in H3. The previous version asserted that a failure at depth 2
  // threw and discarded depth 1's advance — which is the bug FR-CONSOL-08 fixes,
  // not a requirement. Each depth is a billed LLM call; work already paid for
  // must survive a later failure.
  it("keeps a completed depth when a later depth fails", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);

    let sessionCount = 0;
    const createSession = vi.fn(async (): Promise<MaintenanceSessionLike> => {
      sessionCount += 1;
      const thisSession = sessionCount;
      return {
        prompt: async () => {
          if (thisSession === 2) throw new Error("API timeout");
        },
        dispose: () => {},
      };
    });

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;
    state.depth1RunsSinceLastDepth2 = 5;

    const result = await runConsolidation({
      rootDir: dir,
      targetDepth: 2,
      modelRuntime: {} as never,
      state,
      createSession,
    });

    expect(result.completedDepths).toEqual([1]);
    expect(result.stoppedBy).toBe("failure");

    const reloaded = loadConsolidationState(dir);
    expect(reloaded.lastDepth1).not.toBeNull();
    expect(reloaded.lastDepth2).toBeNull();
    expect(depthFailureCount(reloaded, 2)).toBe(1);
    expect(depthFailureCount(reloaded, 1)).toBe(0);

    const log = loadConsolidationLog(dir);
    expect(log).toHaveLength(2);
    expect(log[0]?.status).toBe("success");
    expect(log[1]?.status).toBe("fail");
  });

  it("stops the cascade when the budget threshold is crossed mid-flight", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);

    let prompts = 0;
    const createSession = vi.fn(async (): Promise<MaintenanceSessionLike> => ({
      prompt: async () => { prompts += 1; },
      dispose: () => {},
    }));

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;
    state.depth1RunsSinceLastDepth2 = 5;
    state.depth2RunsSinceLastDepth3 = 4;

    const result = await runConsolidation({
      rootDir: dir,
      targetDepth: 3,
      modelRuntime: {} as never,
      state,
      createSession,
      isBudgetNearLimit: () => prompts >= 1,
    });

    expect(result.completedDepths).toEqual([1]);
    expect(result.stoppedBy).toBe("budget");
    expect(prompts).toBe(1);

    const reloaded = loadConsolidationState(dir);
    expect(reloaded.lastDepth1).not.toBeNull();
    expect(reloaded.lastDepth2).toBeNull();
    expect(loadConsolidationLog(dir).some((e) => e.status === "budget-stopped")).toBe(true);
  });

  it("passes the correct depth to createSession for each cascade level (FR-CONSOL-15)", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);

    const receivedDepths: number[] = [];
    const createSession = vi.fn(async ({ depth }: { rootDir: string; modelRuntime: unknown; depth: number }): Promise<MaintenanceSessionLike> => {
      receivedDepths.push(depth);
      return { prompt: async () => {}, dispose: () => {} };
    });

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;
    state.depth1RunsSinceLastDepth2 = 5;
    state.depth2RunsSinceLastDepth3 = 4;

    await runConsolidation({
      rootDir: dir,
      targetDepth: 3,
      modelRuntime: {} as never,
      state,
      createSession,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(receivedDepths).toEqual([1, 2, 3]);
  });

  it("passes depth 1 for a single-depth run (FR-CONSOL-15)", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);

    const receivedDepths: number[] = [];
    const createSession = vi.fn(async ({ depth }: { rootDir: string; modelRuntime: unknown; depth: number }): Promise<MaintenanceSessionLike> => {
      receivedDepths.push(depth);
      return { prompt: async () => {}, dispose: () => {} };
    });

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;

    await runConsolidation({
      rootDir: dir,
      targetDepth: 1,
      modelRuntime: {} as never,
      state,
      createSession,
      now: new Date("2026-07-22T12:00:00Z"),
    });

    expect(receivedDepths).toEqual([1]);
  });

  it("log rotation does not write to the daily log", async () => {
    setupBuddyDir();
    await initTestGitRepo(dir);
    const logsDir = join(dir, "logs");
    mkdirSync(logsDir, { recursive: true });
    // Create 30 log files (threshold is 28) to trigger rotation
    for (let i = 1; i <= 30; i++) {
      const day = String(i).padStart(2, "0");
      writeFileSync(join(logsDir, `2026-06-${day}.md`), `# ${day}\n`);
    }
    writeFileSync(join(logsDir, "index.md"), "# Sessions index\n");
    const { simpleGit } = await import("simple-git");
    await simpleGit(dir).add("-A").commit("seed");

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;

    await runConsolidation({
      rootDir: dir,
      targetDepth: 1,
      modelRuntime: {} as never,
      state,
      createSession: async () => ({ prompt: async () => {}, dispose: () => {} }),
      now: new Date("2026-07-22T12:00:00Z"),
    });

    // Rotation should have moved files but NOT written to the daily log
    const dailyLogPath = join(logsDir, "2026-07-22.md");
    if (existsSync(dailyLogPath)) {
      const content = readFileSync(dailyLogPath, "utf8");
      expect(content).not.toContain("rotation");
      expect(content).not.toContain("Archived");
    }
    // Archived files should still exist in archive/
    expect(existsSync(join(logsDir, "archive", "2026-06", "2026-06-01.md"))).toBe(true);
  });
});
