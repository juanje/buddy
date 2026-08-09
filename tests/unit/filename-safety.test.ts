// tests/unit/filename-safety.test.ts — NFR-SEC-22 / spike A4.

import { describe, expect, it } from "vitest";

import { windowsFilenameIssue } from "../../shared/filename-safety";
import { evaluateToolCall } from "../../backends/permissions";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

describe("windowsFilenameIssue (NFR-SEC-22)", () => {
  it("accepts ordinary buddy paths", () => {
    expect(windowsFilenameIssue("user/inbox.md")).toBeNull();
    expect(windowsFilenameIssue("agent_brain/concepts/foo-bar.md")).toBeNull();
    expect(windowsFilenameIssue("C:\\Users\\x\\buddy\\user\\notes.md")).toBeNull();
  });

  it("rejects a colon that would create an alternate data stream", () => {
    const issue = windowsFilenameIssue("user/Reunión: plan.md");
    expect(issue).toMatch(/alternate data stream/i);
  });

  it("rejects reserved device names with or without extension", () => {
    expect(windowsFilenameIssue("user/NUL.md")).toMatch(/Reserved Windows device/i);
    expect(windowsFilenameIssue("user/nul")).toMatch(/Reserved Windows device/i);
    expect(windowsFilenameIssue("user/CON.txt")).toMatch(/Reserved Windows device/i);
    expect(windowsFilenameIssue("user/com1.md")).toMatch(/Reserved Windows device/i);
  });

  it("rejects other illegal Windows characters", () => {
    expect(windowsFilenameIssue("user/a|b.md")).toMatch(/Illegal character/);
    expect(windowsFilenameIssue("user/a?.md")).toMatch(/Illegal character/);
  });

  it("rejects trailing space or period on a segment", () => {
    expect(windowsFilenameIssue("user/foo.md.")).toMatch(/space or period/);
    expect(windowsFilenameIssue("user/foo ")).toMatch(/space or period/);
  });
});

describe("evaluateToolCall denies illegal write destinations", () => {
  const home = mkdtempSync(join(tmpdir(), "fn-safe-"));
  const root = join(home, "buddy");
  mkdirSync(join(root, "user"), { recursive: true });

  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("denies write to a colon-bearing path", () => {
    const decision = evaluateToolCall(
      "write",
      { path: "user/Reunión: plan.md" },
      root,
      home,
    );
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.reason).toMatch(/alternate data stream/i);
    }
  });

  it("denies write to NUL.md", () => {
    const decision = evaluateToolCall("write", { path: "user/NUL.md" }, root, home);
    expect(decision.action).toBe("deny");
  });
});
