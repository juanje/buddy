// tests/unit/dashboard-task-row-text.test.ts — FR-DASH-05

import { describe, expect, it } from "vitest";

import { taskRowDisplayText } from "../../backends/dashboard/task-row-text";

describe("taskRowDisplayText", () => {
  it("removes the due date token and normalizes spacing", () => {
    expect(
      taskRowDisplayText("Actualizar el portátil del trabajo. 2026-09-22", "2026-09-22"),
    ).toBe("Actualizar el portátil del trabajo.");
  });

  it("leaves text unchanged when there is no due date", () => {
    expect(taskRowDisplayText("Plain task", undefined)).toBe("Plain task");
  });
});
