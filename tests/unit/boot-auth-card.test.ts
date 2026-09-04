// tests/unit/boot-auth-card.test.ts — FR-AUTH-02/02b boot-time auth error scan.

import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findRecentAuthErrorInLogs, shouldEmitBootAuthCard } from "../../backends/auth-error";
import { logEvent } from "../../backends/app-logger";

describe("findRecentAuthErrorInLogs", () => {
  it("returns the most recent reflect auth failure from today's log", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-boot-auth-"));
    const rootDir = join(dir, "buddy");
    mkdirSync(rootDir, { recursive: true });
    const now = new Date("2026-08-26T10:00:00");

    logEvent(
      rootDir,
      {
        event: "reflect_error",
        session: "s1",
        mode: "session_end",
        message: "OAuth refresh failed for anthropic",
      },
      now,
    );
    logEvent(
      rootDir,
      {
        event: "reflect_error",
        session: "s2",
        mode: "session_end",
        message: "429 rate limit",
      },
      now,
    );
    logEvent(
      rootDir,
      {
        event: "consolidation_error",
        depth: 1,
        error: "invalid_grant for anthropic",
      },
      now,
    );

    expect(findRecentAuthErrorInLogs(rootDir, now)).toEqual({
      provider: "anthropic",
      message: "invalid_grant for anthropic",
    });

    rmSync(dir, { recursive: true, force: true });
  });

  it("returns undefined when no auth failures are logged", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-boot-auth-empty-"));
    const rootDir = join(dir, "buddy");
    mkdirSync(rootDir, { recursive: true });
    const now = new Date("2026-08-26T10:00:00");

    logEvent(
      rootDir,
      { event: "reflect_error", session: "s1", mode: "session_end", message: "timeout" },
      now,
    );

    expect(findRecentAuthErrorInLogs(rootDir, now)).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("shouldEmitBootAuthCard (FR-AUTH-02b)", () => {
  const authError = { provider: "anthropic" as const, message: "OAuth refresh failed for anthropic" };

  it("emits when the provider is in reauthProviders", () => {
    expect(shouldEmitBootAuthCard(authError, new Set(["anthropic"]))).toBe(true);
  });

  it("skips when reauthProviders is empty (health check passed)", () => {
    expect(shouldEmitBootAuthCard(authError, new Set())).toBe(false);
  });

  it("skips when reauthProviders is undefined", () => {
    expect(shouldEmitBootAuthCard(authError, undefined)).toBe(false);
  });

  it("skips when boot auth error is undefined", () => {
    expect(shouldEmitBootAuthCard(undefined, new Set(["anthropic"]))).toBe(false);
  });

  it("maps openai buddy provider to openai-codex pi id", () => {
    const openaiError = { provider: "openai" as const, message: "OAuth refresh failed for openai" };
    expect(shouldEmitBootAuthCard(openaiError, new Set(["openai-codex"]))).toBe(true);
    expect(shouldEmitBootAuthCard(openaiError, new Set(["openai"]))).toBe(false);
  });
});
