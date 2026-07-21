// backends/provider-auth.ts — API key validation + storage (FR-SETUP-04).
//
// Validation uses an injectable probe. The default probe calls the provider's
// model-listing endpoint: it authenticates the key without spending any
// tokens (a chat call would). Tests always inject a fake probe — no network.
//
// Storage writes ~/.buddy/auth.json (AB's own auth store, isolated from
// Pi CLI's ~/.pi/agent/auth.json — NFR-AUTH-ISO). Entry shape matches
// pi-ai's ApiKeyCredential so the SDK reads it natively when ModelRuntime
// is pointed at this path. The path is injectable; tests only touch temp files.

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { KeyCheck, SetupConfig } from "../shared/api";
import { AUTH_FILE_MODE } from "../shared/defaults";
import { toPiProviderId } from "./provider-mapping";

export type ProviderId = SetupConfig["provider"];

/** Probes whether the key authenticates against the provider. */
export type KeyProbe = (
  provider: ProviderId,
  apiKey: string,
  baseUrl?: string,
) => Promise<{ ok: boolean; error?: string }>;

interface ProbeTarget {
  url: (baseUrl?: string) => string;
  headers: (key: string) => Record<string, string>;
}

const PROBE_TARGETS: Record<ProviderId, ProbeTarget> = {
  anthropic: {
    url: () => "https://api.anthropic.com/v1/models",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  },
  openai: {
    url: () => "https://api.openai.com/v1/models",
    headers: (key) => ({ authorization: `Bearer ${key}` }),
  },
  google: {
    url: () => "https://generativelanguage.googleapis.com/v1beta/models",
    headers: (key) => ({ "x-goog-api-key": key }),
  },
  custom: {
    url: (baseUrl) => `${(baseUrl ?? "").replace(/\/$/, "")}/models`,
    headers: (key) => ({ authorization: `Bearer ${key}` }),
  },
};

export const httpKeyProbe: KeyProbe = async (provider, apiKey, baseUrl) => {
  const target = PROBE_TARGETS[provider];
  try {
    const res = await fetch(target.url(baseUrl), { headers: target.headers(apiKey) });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

/** AB's own auth store — separate from Pi CLI's ~/.pi/agent/auth.json (NFR-AUTH-ISO). */
export function defaultAuthPath(): string {
  return process.env.BUDDY_AUTH_PATH ?? process.env.AB_AUTH_PATH ?? join(homedir(), ".buddy", "auth.json");
}

/**
 * Validate the key with a probe call and, only if accepted, persist it into
 * the Pi auth store (merging with existing entries, 0600 permissions).
 */
export async function configureProviderKey(
  provider: ProviderId,
  apiKey: string,
  options: { baseUrl?: string; authPath?: string; probe?: KeyProbe } = {},
): Promise<KeyCheck> {
  if (provider === "custom" && !options.baseUrl) {
    return { valid: false, error: "base URL required for OpenAI-compatible providers" };
  }

  const probe = options.probe ?? httpKeyProbe;
  const result = await probe(provider, apiKey, options.baseUrl);
  if (!result.ok) {
    return { valid: false, error: result.error ?? "key rejected" };
  }

  storeApiKey(options.authPath ?? defaultAuthPath(), toPiProviderId(provider), apiKey);
  return { valid: true };
}

/**
 * Merge the key into AB's auth.json. Entry shape matches pi-ai's
 * ApiKeyCredential ({ type: "api_key", key }) so the SDK reads it natively.
 */
function storeApiKey(authPath: string, piProvider: string, apiKey: string): void {
  let store: Record<string, unknown> = {};
  try {
    store = JSON.parse(readFileSync(authPath, "utf8")) as Record<string, unknown>;
  } catch {
    // Missing or unreadable store: start fresh (never destroy a parseable one).
  }

  store[piProvider] = { type: "api_key", key: apiKey };

  mkdirSync(dirname(authPath), { recursive: true });
  writeFileSync(authPath, JSON.stringify(store, null, 2) + "\n");
  chmodSync(authPath, AUTH_FILE_MODE);
}
