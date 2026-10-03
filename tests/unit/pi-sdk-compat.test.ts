// tests/unit/pi-sdk-compat.test.ts — FR-SDK-01/02 regression guards.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buddySessionsDir } from "../../backends/session-paths";
import { SessionManager } from "@earendil-works/pi-coding-agent";

import type { AgentEvent } from "../../shared/api";
import { FakeSession } from "../support/fake-session";
import {
  declaredPiRange,
  deepImportPaths,
  installedPiVersion,
  majorOf,
  missingDeepImports,
  piCatalogProviders,
} from "../support/pi-sdk";
import { WIZARD_PI_PROVIDERS } from "../../shared/provider-mapping";

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

  it("SessionManager.create accepts rootDir and an explicit session dir", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "buddy-sdk-sm-"));
    const sessionsDir = buddySessionsDir(tmpDir);
    expect(() => SessionManager.create(tmpDir!, sessionsDir)).not.toThrow();
  });

  it("SessionManager exposes forkFrom", () => {
    expect(typeof SessionManager.forkFrom).toBe("function");
  });
});

describe("FR-SDK-04 Pi SDK 1.x integration points", () => {
  it("package.json declares, and node_modules has, Pi 1.x", () => {
    expect(majorOf(declaredPiRange())).toBe(1);
    expect(majorOf(installedPiVersion())).toBe(1);
  });

  it("every literal deep import into Pi internals resolves on disk", () => {
    expect(deepImportPaths().length).toBeGreaterThanOrEqual(3);
    expect(missingDeepImports()).toEqual([]);
  });

  it("exports the entry points Buddy calls", async () => {
    const pi = await import("@earendil-works/pi-coding-agent");
    expect(typeof pi.createAgentSession).toBe("function");
    expect(typeof pi.SessionManager.create).toBe("function");
    expect(typeof pi.SessionManager.forkFrom).toBe("function");
    expect(typeof pi.ModelRuntime).toBe("function");
  });

  it("the Pi catalog still knows every provider Buddy maps", async () => {
    const providers = await piCatalogProviders();
    for (const id of WIZARD_PI_PROVIDERS) expect(providers).toContain(id);
  });
});
