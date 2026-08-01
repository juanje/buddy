// tests/unit/auth-status.test.ts — buildAuthStatus, extracted from
// agent-worker.ts's `getAuthStatus` RPC handler.
//
// Previously only reachable through a fake of the whole worker/RPC surface.
// Here it is a pure function of a `ModelRuntime`, so a fake runtime is enough.

import { describe, expect, it } from "vitest";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { buildAuthStatus } from "../../backends/auth-status";

/** Keeps the suite off the developer's real ~/.buddy/auth.json. */
const NO_STORED = { readCredential: () => undefined };

function fakeRuntime(configured: Record<string, { configured: boolean; oauth?: boolean }>) {
  return {
    getProviderAuthStatus: (piProviderId: string) => ({
      configured: configured[piProviderId]?.configured ?? false,
    }),
    isUsingOAuth: (piProviderId: string) => configured[piProviderId]?.oauth ?? false,
  } as unknown as ModelRuntime;
}

describe("buildAuthStatus falls back to Buddy's own auth store", () => {
  // Reported from real use: sign in to a second provider from Settings, pick a
  // model, and it works — reopen Settings and the provider is gone, offered as
  // "sign in" again, for the rest of the session. `ModelRuntime` answers from a
  // snapshot that only updates when its own refresh completes, and that refresh
  // is what a stalled `pi.dev` hangs (FR-SETUP-05). The credential is on disk
  // the whole time.

  it("reports a provider the runtime has not caught up with", () => {
    const status = buildAuthStatus(fakeRuntime({}), {
      readCredential: (id) => (id === "anthropic" ? '{"type":"oauth"}' : undefined),
    });
    const anthropic = status.providers.find((p) => p.piProviderId === "anthropic");
    expect(anthropic?.hasAuth).toBe(true);
    expect(anthropic?.authType).toBe("oauth");
  });

  it("infers api_key from the stored entry when it is not oauth", () => {
    const status = buildAuthStatus(fakeRuntime({}), {
      readCredential: (id) => (id === "anthropic" ? '{"type":"api_key","key":"x"}' : undefined),
    });
    expect(status.providers.find((p) => p.piProviderId === "anthropic")?.authType).toBe("api_key");
  });

  it("does not overrule the runtime when it already knows", () => {
    // The runtime sees sources auth.json cannot (runtime keys, env vars), so
    // its answer wins wherever it has one.
    const status = buildAuthStatus(fakeRuntime({ anthropic: { configured: true, oauth: true } }), {
      readCredential: () => undefined,
    });
    expect(status.providers.find((p) => p.piProviderId === "anthropic")?.authType).toBe("oauth");
  });

  it("still reports nothing when neither source has the provider", () => {
    const status = buildAuthStatus(fakeRuntime({}), { readCredential: () => undefined });
    for (const provider of status.providers) {
      expect(provider.hasAuth).toBe(false);
    }
  });
});

describe("buildAuthStatus", () => {
  it("reports api_key auth for a configured, non-oauth provider", () => {
    const status = buildAuthStatus(fakeRuntime({ anthropic: { configured: true } }), NO_STORED);
    const anthropic = status.providers.find((p) => p.piProviderId === "anthropic");
    expect(anthropic?.hasAuth).toBe(true);
    expect(anthropic?.authType).toBe("api_key");
  });

  it("reports oauth auth when the provider is using it", () => {
    const status = buildAuthStatus(
      fakeRuntime({ "openai-codex": { configured: true, oauth: true } }),
      NO_STORED,
    );
    const codex = status.providers.find((p) => p.piProviderId === "openai-codex");
    expect(codex?.authType).toBe("oauth");
  });

  it("leaves authType undefined for an unconfigured provider", () => {
    const status = buildAuthStatus(fakeRuntime({}), NO_STORED);
    for (const provider of status.providers) {
      expect(provider.hasAuth).toBe(false);
      expect(provider.authType).toBeUndefined();
    }
  });

  it("covers every wizard-facing provider, not just configured ones", () => {
    const status = buildAuthStatus(fakeRuntime({ anthropic: { configured: true } }), NO_STORED);
    expect(status.providers.length).toBeGreaterThan(1);
  });
});
