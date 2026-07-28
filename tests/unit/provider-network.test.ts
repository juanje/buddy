// tests/unit/provider-network.test.ts — NFR-SEC-18, NFR-REL-09.
//
// Two problems on the same code path, the setup wizard's provider step.
//
// NFR-SEC-18: the custom base URL is the only destination in the app the user
// types by hand, and the next thing that happens is their API key going to it
// in an Authorization header. Nothing checked it. `http://localhost:8080` or a
// hostname resolving to 169.254.169.254 received the credential.
//
// NFR-REL-09: neither the key probe nor the model listing had a timeout. A
// provider that accepts the connection and then stalls left the wizard on a
// spinner with no cancel — and in the model case, with a perfectly good curated
// catalog sitting unused.

import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configureProviderKey } from "../../backends/provider-auth";
import { listModelsForProvider } from "../../backends/model-listing";

function authPath(): string {
  return join(mkdtempSync(join(tmpdir(), "provider-network-")), "auth.json");
}

/** A resolver that claims every name is an ordinary public address. */
const publicDns = async () => ["93.184.216.34"];

describe("custom base URL validation (NFR-SEC-18)", () => {
  it.each([
    ["http://169.254.169.254/latest", /refusing to send credentials/i],
    ["http://metadata.google.internal/v1", /refusing to send credentials/i],
    ["file:///etc/passwd", /must start with http/i],
    ["ftp://example.com/v1", /must start with http/i],
    ["not a url at all", /not a valid url/i],
    ["http://0.0.0.0:8080/v1", /refusing to send credentials/i],
  ])("refuses %s", async (baseUrl, expected) => {
    const probe = vi.fn(async () => ({ ok: true }));
    const path = authPath();

    const result = await configureProviderKey("custom", "sk-secret", {
      baseUrl,
      authPath: path,
      probe,
      lookupFn: publicDns,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(expected);
    // The point is not the error message. The point is that the key was never
    // sent and never stored.
    expect(probe).not.toHaveBeenCalled();
    expect(existsSync(path)).toBe(false);
  });

  it("refuses a hostname that resolves to cloud metadata", async () => {
    const probe = vi.fn(async () => ({ ok: true }));
    const result = await configureProviderKey("custom", "sk-secret", {
      baseUrl: "https://my-llm.example.com/v1",
      authPath: authPath(),
      probe,
      lookupFn: async () => ["169.254.169.254"],
    });

    expect(result.valid).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });

  // The rules here are deliberately narrower than fetch_url's (NFR-SEC-12).
  // A local model server is the reason the "custom" provider exists, and the
  // URL is typed by the user rather than chosen by the agent.
  it.each([
    "http://localhost:11434/v1",
    "http://127.0.0.1:1234/v1",
    "http://192.168.1.50:8080/v1",
    "http://my-server.local:11434/v1",
  ])("allows %s — a local or LAN model server", async (baseUrl) => {
    const path = authPath();
    const result = await configureProviderKey("custom", "sk-secret", {
      baseUrl,
      authPath: path,
      probe: async () => ({ ok: true }),
      lookupFn: async () => ["192.168.1.50"],
    });

    expect(result).toEqual({ valid: true });
    expect(existsSync(path)).toBe(true);
  });

  it("accepts an ordinary public base URL and stores the key", async () => {
    const probe = vi.fn(async () => ({ ok: true }));
    const path = authPath();

    const result = await configureProviderKey("custom", "sk-secret", {
      baseUrl: "https://api.example.com/v1",
      authPath: path,
      probe,
      lookupFn: publicDns,
    });

    expect(result).toEqual({ valid: true });
    expect(probe).toHaveBeenCalledOnce();
    expect(existsSync(path)).toBe(true);
  });

  it("does not apply URL rules to the built-in providers", async () => {
    // Their endpoints are constants in this file, not user input.
    const result = await configureProviderKey("anthropic", "sk-ant", {
      authPath: authPath(),
      probe: async () => ({ ok: true }),
    });
    expect(result).toEqual({ valid: true });
  });
});

describe("model listing is bounded (NFR-REL-09)", () => {
  it("falls back to the curated catalog when the provider stalls", async () => {
    const runtime = { getAvailable: () => new Promise<never>(() => {}) };

    const models = await listModelsForProvider(runtime, "anthropic", 20);

    // Not an empty list and not a hang: the catalog the wizard could have shown
    // all along.
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.provider === "anthropic")).toBe(true);
  });

  it("still prefers the live list when it arrives in time", async () => {
    const runtime = {
      getAvailable: async () => [{ id: "live-model", name: "Live Model" }],
    };

    const models = await listModelsForProvider(runtime, "anthropic", 1_000);

    expect(models).toEqual([
      { id: "live-model", label: "Live Model", provider: "anthropic", recommended: false },
    ]);
  });
});
