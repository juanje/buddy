// tests/unit/consolidation-runner.test.ts — FR-CONSOL-03/04/06 runner behavior.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
import { loadConsolidationLog, loadConsolidationState } from "../../shared/consolidation-state";
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

  function setupAb(): void {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir({
      consolidationSkill: "# Skill\n\nDo consolidation.\n",
    }, vi));
    dir = mkdtempSync(join(tmpdir(), "ab-consol-run-"));
    writeFileSync(join(dir, "AGENTS.md"), "# Rules\n");
    writeFileSync(join(dir, "notes.txt"), "hello\n");
  }

  it("builds consolidation prompt from the global skill file", () => {
    setupAb();
    const prompt = buildConsolidationPrompt(dir, 1, new Date("2026-07-22T12:00:00Z"));
    expect(prompt).toContain("Date:");
    expect(prompt).toContain("Run consolidation at depth 1");
    expect(prompt).toContain("Do consolidation.");
    expect(prompt).toContain("Do not run git commands");
    expect(prompt).toContain("Hebbian promotion data (pre-computed):");
    expect(prompt).toContain("Upcoming items (within 24h of run date):");
  });

  it("falls back to legacy rootDir skill file", () => {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir(undefined, vi));
    dir = mkdtempSync(join(tmpdir(), "ab-consol-run-"));
    mkdirSync(join(dir, ".buddy", "prompts"), { recursive: true });
    writeFileSync(
      join(dir, ".buddy", "prompts", "consolidation.md"),
      "# Legacy\n\nLegacy consolidation.\n",
    );

    const prompt = buildConsolidationPrompt(dir, 1);
    expect(prompt).toContain("Legacy consolidation.");
  });

  it("runs cascade depths, commits, and advances counters", async () => {
    setupAb();
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
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(loadConsolidationState(dir).lastDepth2).toBe("2026-07-22T12:00:00.000Z");

    const log = loadConsolidationLog(dir);
    expect(log).toHaveLength(2);
    expect(log.every((entry) => entry.status === "success")).toBe(true);
  });

  it("defers when maintenance lock is held", async () => {
    setupAb();
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

  it("does not advance counters when a depth fails", async () => {
    setupAb();
    await initTestGitRepo(dir);

    let calls = 0;
    const createSession = vi.fn(async (): Promise<MaintenanceSessionLike> => ({
      prompt: async () => {
        calls += 1;
        if (calls === 2) throw new Error("API timeout");
      },
      dispose: () => {},
    }));

    const state = loadConsolidationState(dir);
    state.sessionsSinceLastDepth1 = 3;
    state.depth1RunsSinceLastDepth2 = 5;

    await expect(
      runConsolidation({
        rootDir: dir,
        targetDepth: 2,
        modelRuntime: {} as never,
        state,
        createSession,
      }),
    ).rejects.toThrow("API timeout");

    const reloaded = loadConsolidationState(dir);
    expect(reloaded.lastDepth1).toBeNull();
    expect(reloaded.lastDepth2).toBeNull();

    const log = loadConsolidationLog(dir);
    expect(log).toHaveLength(2);
    expect(log[0]?.status).toBe("success");
    expect(log[1]?.status).toBe("fail");
  });
});
