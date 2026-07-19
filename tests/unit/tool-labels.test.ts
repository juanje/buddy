// tests/unit/tool-labels.test.ts — FR-CHAT-06 tool activity labels.

import { describe, expect, it } from "vitest";

import type { ToolCallEntry } from "../../src/lib/chat-controller";
import { en } from "../../src/lib/i18n/en";
import { toolActivitySummary, toolCallLabel } from "../../src/lib/tool-labels";

describe("toolCallLabel", () => {
  it("labels read with filename", () => {
    const entry: ToolCallEntry = { name: "read", path: "/tmp/notes.md", status: "done" };
    expect(toolCallLabel(entry, en)).toBe("Reading notes.md");
  });

  it("labels grep as searching", () => {
    const entry: ToolCallEntry = { name: "grep", status: "running" };
    expect(toolCallLabel(entry, en)).toBe("Searching…");
  });
});

describe("toolActivitySummary", () => {
  it("summarizes multiple reads", () => {
    const calls: ToolCallEntry[] = [
      { name: "read", path: "/a.md", status: "done" },
      { name: "read", path: "/b.md", status: "done" },
    ];
    expect(toolActivitySummary(calls, en)).toBe("Read 2 files");
  });
});
