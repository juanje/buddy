// tests/unit/session-tracker.test.ts — relPath prefix safety.

import { describe, expect, it } from "vitest";

import { SessionTracker } from "../../backends/session-tracker";

describe("SessionTracker relPath", () => {
  it("does not treat sibling directories as inside the AB home", () => {
    const tracker = new SessionTracker("s1");
    tracker.recordEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "read",
        args: { path: "/home/u/buddy2/notes.md" },
      },
      "/home/u/buddy",
    );
    tracker.recordEvent(
      {
        type: "tool_execution_end",
        toolCallId: "tc1",
        toolName: "read",
        args: { path: "/home/u/buddy2/notes.md" },
      },
      "/home/u/buddy",
    );

    expect(tracker.filesRead).toEqual(["/home/u/buddy2/notes.md"]);
  });

  it("stores paths relative to the AB home when under the prefix", () => {
    const tracker = new SessionTracker("s1");
    tracker.recordEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "read",
        args: { path: "/home/u/buddy/user/inbox.md" },
      },
      "/home/u/buddy",
    );
    tracker.recordEvent(
      {
        type: "tool_execution_end",
        toolCallId: "tc1",
        toolName: "read",
        args: { path: "/home/u/buddy/user/inbox.md" },
      },
      "/home/u/buddy",
    );

    expect(tracker.filesRead).toEqual(["user/inbox.md"]);
  });
});
