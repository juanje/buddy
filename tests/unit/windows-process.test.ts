// tests/unit/windows-process.test.ts — NFR-PORT-09 child-console hide helper.

import { describe, expect, it } from "vitest";

import { windowsHideSpawnOption } from "../../backends/windows-process";

describe("windowsHideSpawnOption", () => {
  it("sets windowsHide on win32 (chat-path git/icacls/attrib)", () => {
    expect(windowsHideSpawnOption("win32")).toEqual({ windowsHide: true });
  });

  it("is a no-op object on POSIX", () => {
    expect(windowsHideSpawnOption("linux")).toEqual({});
    expect(windowsHideSpawnOption("darwin")).toEqual({});
  });
});
