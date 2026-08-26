// tests/unit/auth-health-check.test.ts — FR-AUTH-01 OAuth health probes.

import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildAuthStatus } from "../../backends/auth-status";
import { probeProviderAuth, runOAuthHealthChecks } from "../../backends/auth-health";
import { purgeStaleCredential } from "../../backends/provider-auth";
import { updateStateFile } from "../../backends/state-file";
import { AUTH_FILE_MODE } from "../../shared/defaults";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

describe("probeProviderAuth", () => {
  it("returns healthy when model listing succeeds", async () => {
    const runtime = {
      getAvailable: async () => [{ id: "claude" }],
    };
    await expect(probeProviderAuth(runtime, "anthropic")).resolves.toEqual({ healthy: true });
  });

  it("returns unhealthy on OAuth refresh failure", async () => {
    const runtime = {
      getAvailable: async () => {
        throw new Error("OAuth refresh failed for anthropic");
      },
    };
    await expect(probeProviderAuth(runtime, "anthropic")).resolves.toEqual({
      healthy: false,
      reason: "OAuth refresh failed for anthropic",
    });
  });

  it("treats non-auth failures as healthy", async () => {
    const runtime = {
      getAvailable: async () => {
        throw new Error("network timeout");
      },
    };
    await expect(probeProviderAuth(runtime, "anthropic")).resolves.toEqual({ healthy: true });
  });
});

describe("purgeStaleCredential", () => {
  it("removes the provider entry from auth.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-auth-purge-"));
    const authPath = join(dir, "auth.json");
    updateStateFile<Record<string, unknown>>(
      authPath,
      () => ({
        anthropic: { type: "oauth" },
        "openai-codex": { type: "oauth" },
      }),
      { mode: AUTH_FILE_MODE },
    );

    purgeStaleCredential("anthropic", authPath);
    const stored = JSON.parse(readFileSync(authPath, "utf8")) as Record<string, unknown>;
    expect(stored.anthropic).toBeUndefined();
    expect(stored["openai-codex"]).toBeDefined();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("runOAuthHealthChecks", () => {
  it("purges stale OAuth providers and returns their ids", async () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-auth-health-"));
    const authPath = join(dir, "auth.json");
    updateStateFile<Record<string, unknown>>(
      authPath,
      () => ({ anthropic: { type: "oauth", refresh: "dead" } }),
      { mode: AUTH_FILE_MODE },
    );

    const runtime = {
      getAvailable: async (providerId?: string) => {
        if (providerId === "anthropic") throw new Error("invalid_grant");
        return [];
      },
    };

    const needsReauth = await runOAuthHealthChecks(runtime, {
      readCredential: (id) => {
        const stored = JSON.parse(readFileSync(authPath, "utf8")) as Record<string, unknown>;
        const entry = stored[id];
        return entry === undefined ? undefined : JSON.stringify(entry);
      },
      purge: (id) => purgeStaleCredential(id, authPath),
      authPath,
    });

    expect([...needsReauth]).toEqual(["anthropic"]);
    const stored = JSON.parse(readFileSync(authPath, "utf8")) as Record<string, unknown>;
    expect(stored.anthropic).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("buildAuthStatus needsReauth", () => {
  it("reports needsReauth when probe failed", () => {
    const runtime = {
      getProviderAuthStatus: () => ({ configured: false }),
      isUsingOAuth: () => false,
    } as unknown as ModelRuntime;

    const status = buildAuthStatus(runtime, {
      readCredential: () => '{"type":"oauth"}',
      needsReauthProviders: new Set(["anthropic"]),
    });
    const anthropic = status.providers.find((p) => p.piProviderId === "anthropic");
    expect(anthropic?.needsReauth).toBe(true);
    expect(anthropic?.hasAuth).toBe(false);
  });
});
