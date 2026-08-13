// tests/unit/reflect-interrupt.test.ts — NFR-REL-11 / spike A9.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  commitReflectInterrupted,
  installReflectInterruptHandlers,
  reflectInterruptSignals,
  reflectInterruptedMessage,
} from "../../backends/reflect-interrupt";
import { GIT_COMMIT_PREFIX } from "../../shared/defaults";

const commitAll = vi.fn();

vi.mock("../../backends/git", () => ({
  commitAll: (...args: unknown[]) => commitAll(...args),
}));

afterEach(() => {
  commitAll.mockReset();
});

describe("reflectInterruptedMessage", () => {
  it("builds a message without shell-quoted fragments", () => {
    const msg = reflectInterruptedMessage("SIGINT");
    expect(msg).toBe(`${GIT_COMMIT_PREFIX} reflect interrupted (SIGINT)`);
    expect(msg).not.toMatch(/'/);
  });
});

describe("reflectInterruptSignals", () => {
  it("includes SIGINT and SIGTERM on every platform", () => {
    expect(reflectInterruptSignals("linux")).toEqual(["SIGINT", "SIGTERM"]);
    expect(reflectInterruptSignals("darwin")).toEqual(["SIGINT", "SIGTERM"]);
  });

  it("adds SIGBREAK on Windows (NFR-REL-11)", () => {
    expect(reflectInterruptSignals("win32")).toEqual(["SIGINT", "SIGTERM", "SIGBREAK"]);
  });
});

describe("commitReflectInterrupted", () => {
  it("delegates to commitAll with the interrupt message (FR-REFLECT-06 lock)", async () => {
    commitAll.mockResolvedValue("ok");
    await commitReflectInterrupted("/tmp/buddy", "SIGTERM");
    expect(commitAll).toHaveBeenCalledWith(
      "/tmp/buddy",
      `${GIT_COMMIT_PREFIX} reflect interrupted (SIGTERM)`,
    );
  });

  it("swallows commit failures so exit can proceed", async () => {
    commitAll.mockRejectedValue(new Error("lock busy"));
    await expect(commitReflectInterrupted("/tmp/buddy", "SIGINT")).resolves.toBeUndefined();
  });
});

describe("installReflectInterruptHandlers", () => {
  it("commits via the injected helper and exits once", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();
    const dispose = installReflectInterruptHandlers("/tmp/buddy", {
      signals: ["SIGTERM"],
      commit,
      exit,
    });

    process.emit("SIGTERM");
    process.emit("SIGTERM"); // second must be ignored while exiting

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("/tmp/buddy", "SIGTERM");
    dispose();
  });
});
