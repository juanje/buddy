// tests/unit/auth-status.test.ts — buildAuthStatus, extracted from
// agent-worker.ts's `getAuthStatus` RPC handler.
//
// Previously only reachable through a fake of the whole worker/RPC surface.
// Here it is a pure function of a `ModelRuntime`, so a fake runtime is enough.

import { describe, expect, it } from "vitest";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { buildAuthStatus } from "../../backends/auth-status";

function fakeRuntime(configured: Record<string, { configured: boolean; oauth?: boolean }>) {
  return {
    getProviderAuthStatus: (piProviderId: string) => ({
      configured: configured[piProviderId]?.configured ?? false,
    }),
    isUsingOAuth: (piProviderId: string) => configured[piProviderId]?.oauth ?? false,
  } as unknown as ModelRuntime;
}

describe("buildAuthStatus", () => {
  it("reports api_key auth for a configured, non-oauth provider", () => {
    const status = buildAuthStatus(fakeRuntime({ anthropic: { configured: true } }));
    const anthropic = status.providers.find((p) => p.piProviderId === "anthropic");
    expect(anthropic?.hasAuth).toBe(true);
    expect(anthropic?.authType).toBe("api_key");
  });

  it("reports oauth auth when the provider is using it", () => {
    const status = buildAuthStatus(
      fakeRuntime({ "openai-codex": { configured: true, oauth: true } }),
    );
    const codex = status.providers.find((p) => p.piProviderId === "openai-codex");
    expect(codex?.authType).toBe("oauth");
  });

  it("leaves authType undefined for an unconfigured provider", () => {
    const status = buildAuthStatus(fakeRuntime({}));
    for (const provider of status.providers) {
      expect(provider.hasAuth).toBe(false);
      expect(provider.authType).toBeUndefined();
    }
  });

  it("covers every wizard-facing provider, not just configured ones", () => {
    const status = buildAuthStatus(fakeRuntime({ anthropic: { configured: true } }));
    expect(status.providers.length).toBeGreaterThan(1);
  });
});
