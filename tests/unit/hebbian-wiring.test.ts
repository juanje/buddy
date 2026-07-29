// tests/unit/hebbian-wiring.test.ts — FR-HEBB-07.
//
// The Hebbian layer never recorded a single access, on any install, for any
// provider. Not because the tracker was wrong — it works in isolation — but
// because it was never called.
//
// `tool_execution_end` carries `toolCallId`, `toolName`, `result` and
// `isError`. It does **not** carry `args`, so `extractToolInfo(event).path` was
// always undefined and the `info?.path` guard silently skipped every read. The
// neighbouring `turnDirty` flags kept working because they test only the tool
// name — which is why auto-commit behaved correctly and made the layer look
// alive.
//
// Found 2026-07-29 by asking why a file with `access_count: 0` stayed at 0
// after a session that demonstrably read it.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFileConsultation } from "../../backends/hebbian";
import { SessionLifecycle } from "../../backends/session-lifecycle";
import { initTestGitRepo } from "../support/test-git";

let root: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "hebbian-wiring-"));
  mkdirSync(join(root, "agent_brain", "concepts"), { recursive: true });
  writeFileSync(
    join(root, "agent_brain", "concepts", "thing.md"),
    "---\nsummary: A thing\ncreated: 2026-07-01\nlast_accessed: 2026-07-01\naccess_count: 3\n---\n\n# Thing\n",
    "utf8",
  );
  // The turn ends with an auto-commit; without a repo the flush throws before
  // the assertion, hiding whether tracking happened.
  await initTestGitRepo(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const REL = "agent_brain/concepts/thing.md";
const countOf = () =>
  /access_count: (\d+)/.exec(readFileSync(join(root, REL), "utf8"))?.[1];

describe("isFileConsultation", () => {
  it("counts a read of a specific file", () => {
    expect(isFileConsultation("read", REL, root)).toBe(true);
  });

  it("counts a grep aimed at one file — that is consultation, just cheaper", () => {
    expect(isFileConsultation("grep", REL, root)).toBe(true);
  });

  it("does not count a grep over a directory", () => {
    // Brute force says nothing about which files matter. Crediting every file
    // under a tree for one recursive search would drown the real signal.
    expect(isFileConsultation("grep", "agent_brain/concepts", root)).toBe(false);
    expect(isFileConsultation("grep", "", root)).toBe(false);
    expect(isFileConsultation("grep", undefined, root)).toBe(false);
  });

  it("does not count writes or unrelated tools", () => {
    expect(isFileConsultation("write", REL, root)).toBe(false);
    expect(isFileConsultation("edit", REL, root)).toBe(false);
    expect(isFileConsultation("fetch_url", REL, root)).toBe(false);
  });

  it("does not count a path that is not there", () => {
    expect(isFileConsultation("grep", "agent_brain/concepts/gone.md", root)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The wiring — the part that was broken. These feed the lifecycle the event
// shapes the SDK actually emits.
// ---------------------------------------------------------------------------

describe("the lifecycle records an access from the events the SDK emits", () => {
  function lifecycle(): SessionLifecycle {
    return new SessionLifecycle({ rootDir: root, sessionId: "test", spawnReflect: () => {} } as never);
  }

  /** Exactly what the SDK sends: args on start, absent on end. */
  async function toolCall(life: SessionLifecycle, name: string, path: string, id = "call-1") {
    await life.handleEvent({
      type: "tool_execution_start",
      toolCallId: id,
      toolName: name,
      args: { path },
    } as never);
    await life.handleEvent({
      type: "tool_execution_end",
      toolCallId: id,
      toolName: name,
      isError: false,
    } as never);
    // The turn closes on `agent_end`, which is when the tracker flushes.
    await life.handleEvent({ type: "agent_end" } as never);
    await life.flush();
  }

  it("increments after a read, though the end event carries no path", async () => {
    // The whole defect in one assertion.
    await toolCall(lifecycle(), "read", REL);
    expect(countOf()).toBe("4");
  });

  it("increments after a grep aimed at that file", async () => {
    await toolCall(lifecycle(), "grep", REL);
    expect(countOf()).toBe("4");
  });

  it("does not increment after a grep over a directory", async () => {
    await toolCall(lifecycle(), "grep", "agent_brain/concepts");
    expect(countOf()).toBe("3");
  });

  it("does not increment when the tool call failed", async () => {
    const life = lifecycle();
    await life.handleEvent({
      type: "tool_execution_start",
      toolCallId: "c",
      toolName: "read",
      args: { path: REL },
    } as never);
    await life.handleEvent({
      type: "tool_execution_end",
      toolCallId: "c",
      toolName: "read",
      isError: true,
    } as never);
    await life.handleEvent({ type: "agent_end" } as never);
    await life.flush();

    expect(countOf()).toBe("3");
  });

  it("counts a file once per session however often it is read", async () => {
    const life = lifecycle();
    await toolCall(life, "read", REL, "a");
    await toolCall(life, "read", REL, "b");
    expect(countOf()).toBe("4");
  });
});
