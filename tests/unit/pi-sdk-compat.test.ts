// tests/unit/pi-sdk-compat.test.ts — FR-SDK-01/02 regression guards.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import type { AgentEvent } from "../../shared/api";
import { FakeSession } from "../support/fake-session";

describe("FR-SDK-01 delta-only streaming fixtures", () => {
  it("FakeSession emits delta-only message_update without cumulative fields", () => {
    const session = new FakeSession();
    const events: AgentEvent[] = [];
    session.subscribe((event) => events.push(event));
    session.beginStreaming();
    session.emitTextDelta("Hi");
    const update = events.find((event) => event.type === "message_update");
    expect(update).toBeDefined();
    expect(update).not.toHaveProperty("message");
    const assistantEvent = update!.assistantMessageEvent as Record<string, unknown>;
    expect(assistantEvent).not.toHaveProperty("partial");
    expect(assistantEvent.delta).toBe("Hi");
  });
});

describe("FR-SDK-02 session management compatibility", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  });

  it("SessionManager.create accepts a rootDir string", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "buddy-sdk-sm-"));
    expect(() => SessionManager.create(tmpDir!)).not.toThrow();
  });

  it("SessionManager exposes forkFrom", () => {
    expect(typeof SessionManager.forkFrom).toBe("function");
  });
});
