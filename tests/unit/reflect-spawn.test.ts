// tests/unit/reflect-spawn.test.ts — E13b reflect spawn (dev fork vs prod argv dispatch).

import { afterEach, describe, expect, it, vi } from "vitest";

const forkMock = vi.fn();
const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  fork: (...args: unknown[]) => forkMock(...args),
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { sidecarBootTarget } from "../../backends/sidecar-dispatch";
import {
  isCompiledBinary,
  spawnReflectChild,
  type SpawnReflectOptions,
} from "../../backends/reflect-spawn";

describe("sidecarBootTarget", () => {
  it("routes --reflect to reflect-child module", () => {
    expect(sidecarBootTarget(["/bin/agent-worker", "--reflect", "/ab"])).toBe("reflect-child");
  });

  it("routes normal argv to agent-worker module", () => {
    expect(sidecarBootTarget(["/bin/agent-worker"])).toBe("agent-worker");
    expect(sidecarBootTarget(["/bin/agent-worker", "--some-flag"])).toBe("agent-worker");
  });
});

describe("spawnReflectChild", () => {
  const baseOptions: SpawnReflectOptions = {
    rootDir: "/tmp/ab",
    forkedSessionFile: "/tmp/session.jsonl",
    mode: "session-end",
    sessionId: "abc12345",
    sessionDate: "2026-07-23",
    sessionStart: "14:30",
    sessionEnd: "15:45",
  };

  afterEach(() => {
    forkMock.mockReset();
    spawnMock.mockReset();
    delete (globalThis as { Bun?: unknown }).Bun;
  });

  it("forks reflect-child.ts in dev (no Bun global)", () => {
    forkMock.mockReturnValue({ unref: vi.fn(), pid: 42 });

    const pid = spawnReflectChild(baseOptions);

    expect(pid).toBe(42);
    expect(forkMock).toHaveBeenCalledOnce();
    expect(spawnMock).not.toHaveBeenCalled();
    const forkArgs = forkMock.mock.calls[0][1] as string[];
    expect(forkArgs).toEqual([
      baseOptions.rootDir,
      baseOptions.forkedSessionFile,
      "session-end",
      baseOptions.sessionId,
      baseOptions.sessionDate,
      baseOptions.sessionStart,
      baseOptions.sessionEnd,
    ]);
  });

  it("spawns execPath with --reflect in compiled binary", () => {
    (globalThis as { Bun?: unknown }).Bun = {};
    spawnMock.mockReturnValue({ unref: vi.fn(), pid: 99 });

    const pid = spawnReflectChild(baseOptions);

    expect(pid).toBe(99);
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(forkMock).not.toHaveBeenCalled();
    const [execPath, argv] = spawnMock.mock.calls[0] as [string, string[]];
    expect(execPath).toBe(process.execPath);
    expect(argv[0]).toBe("--reflect");
    expect(argv.slice(1)).toEqual([
      baseOptions.rootDir,
      baseOptions.forkedSessionFile,
      "session-end",
      baseOptions.sessionId,
      baseOptions.sessionDate,
      baseOptions.sessionStart,
      baseOptions.sessionEnd,
    ]);
  });

  it("appends checkpoint date/time args for checkpoint mode", () => {
    forkMock.mockReturnValue({ unref: vi.fn(), pid: 1 });

    spawnReflectChild({
      ...baseOptions,
      mode: "checkpoint",
      checkpointDate: "2026-07-23",
      checkpointTime: "14:30",
    });

    const forkArgs = forkMock.mock.calls[0][1] as string[];
    expect(forkArgs).toEqual([
      baseOptions.rootDir,
      baseOptions.forkedSessionFile,
      "checkpoint",
      baseOptions.sessionId,
      baseOptions.sessionDate,
      baseOptions.sessionStart,
      baseOptions.sessionEnd,
      "2026-07-23",
      "14:30",
    ]);
  });
});

describe("isCompiledBinary", () => {
  afterEach(() => {
    delete (globalThis as { Bun?: unknown }).Bun;
  });

  it("is false in Node dev", () => {
    expect(isCompiledBinary()).toBe(false);
  });

  it("is true when Bun global is present", () => {
    (globalThis as { Bun?: unknown }).Bun = {};
    expect(isCompiledBinary()).toBe(true);
  });
});
