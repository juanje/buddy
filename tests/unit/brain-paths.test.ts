// tests/unit/brain-paths.test.ts — FR-TASKM-20: WORKSPACES_DIR constant.

import { describe, expect, it } from "vitest";

import { WORKSPACES_DIR } from "../../shared/brain-paths";

describe("WORKSPACES_DIR", () => {
  it("equals user/workspaces", () => {
    expect(WORKSPACES_DIR).toBe("user/workspaces");
  });
});
