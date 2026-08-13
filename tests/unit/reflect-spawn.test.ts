// tests/unit/reflect-spawn.test.ts — E13b reflect spawn (dev fork vs prod argv dispatch).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  windowsHideSpawnOption,
  type SpawnReflectOptions,
} from "../../backends/reflect-spawn";
import {
  FORBID_REAL_REFLECT_SPAWN_ENV,
  REFLECT_CHILD_ENV_KEY,
  REFLECT_CHILD_ENV_VALUE,
} from "../../shared/defaults";

describe("sidecarBootTarget", () => {
  it("routes --reflect to reflect-child module", () => {
    expect(sidecarBootTarget(["/bin/agent-worker", "--reflect", "/tmp/buddy"])).toBe("reflect-child");
  });

  it("routes normal argv to agent-worker module", () => {
    expect(sidecarBootTarget(["/bin/agent-worker"])).toBe("agent-worker");
    expect(sidecarBootTarget(["/bin/agent-worker", "--some-flag"])).toBe("agent-worker");
  });
});

describe("spawnReflectChild", () => {
  const baseOptions: SpawnReflectOptions = {
    rootDir: "/tmp/buddy",
    forkedSessionFile: "/tmp/session.jsonl",
    mode: "session-end",
    sessionId: "abc12345",
    sessionDate: "2026-07-23",
    sessionStart: "14:30",
    sessionEnd: "15:45",
  };

  // The only place allowed to disarm the NFR-TEST-02 guard: this file's subject
  // *is* spawnReflectChild, and node:child_process is mocked above, so nothing
  // real is forked. The opt-out is explicit and scoped to this describe block —
  // everywhere else the guard stands.
  beforeEach(() => {
    delete process.env[FORBID_REAL_REFLECT_SPAWN_ENV];
  });

  afterEach(() => {
    forkMock.mockReset();
    spawnMock.mockReset();
    delete (globalThis as { Bun?: unknown }).Bun;
    delete process.env[REFLECT_CHILD_ENV_KEY];
    process.env[FORBID_REAL_REFLECT_SPAWN_ENV] = "1";
  });

  it("throws rather than forking when the test guard is armed (NFR-TEST-02)", () => {
    process.env[FORBID_REAL_REFLECT_SPAWN_ENV] = "1";
    forkMock.mockReturnValue({ unref: vi.fn(), pid: 42 });

    // Throwing, not returning undefined: a silent no-op is how the BDD suite
    // forked a real child on every run without anyone noticing.
    expect(() => spawnReflectChild(baseOptions)).toThrow(/reached under a test runner/);
    expect(forkMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses nested spawn when already a reflect child", () => {
    process.env[REFLECT_CHILD_ENV_KEY] = REFLECT_CHILD_ENV_VALUE;
    forkMock.mockReturnValue({ unref: vi.fn(), pid: 42 });

    const pid = spawnReflectChild(baseOptions);

    expect(pid).toBeUndefined();
    expect(forkMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
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
    const [execPath, argv, opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { windowsHide?: boolean; detached?: boolean },
    ];
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
    expect(opts.detached).toBe(true);
    if (process.platform === "win32") {
      expect(opts.windowsHide).toBe(true);
    } else {
      expect(opts.windowsHide).toBeUndefined();
    }
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

describe("windowsHideSpawnOption", () => {
  it("sets windowsHide on win32 (NFR-PORT-09 / C2)", () => {
    expect(windowsHideSpawnOption("win32")).toEqual({ windowsHide: true });
  });

  it("is empty on unix", () => {
    expect(windowsHideSpawnOption("linux")).toEqual({});
    expect(windowsHideSpawnOption("darwin")).toEqual({});
  });
});
