// backends/provider-auth.ts — API key validation + storage (FR-SETUP-04).
//
// Validation uses an injectable probe. The default probe calls the provider's
// model-listing endpoint: it authenticates the key without spending any
// tokens (a chat call would). Tests always inject a fake probe — no network.
//
// Storage writes ~/.buddy/auth.json (buddy's own auth store, isolated from
// Pi CLI's ~/.pi/agent/auth.json — NFR-AUTH-ISO). Entry shape matches
// pi-ai's ApiKeyCredential so the SDK reads it natively when ModelRuntime
// is pointed at this path. The path is injectable; tests only touch temp files.

import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";

import { updateStateFile } from "./state-file";
import type { KeyCheck, SetupConfig } from "../shared/api";
import {
  AUTH_FILE_MODE,
  AUTH_FILE_NAME,
  GLOBAL_CONFIG_DIR_NAME,
  LEGACY_AUTH_PATH_ENV,
  MODEL_CATALOG_REFRESH_TIMEOUT_MS,
  PROVIDER_REQUEST_TIMEOUT_MS,
} from "../shared/defaults";
import { buddyModelsPath, buddyModelsStorePath } from "./global-config";
import { toPiProviderId } from "../shared/provider-mapping";
import { assertSafeProviderBaseUrl, UnsafeUrlError, type DnsLookupFn } from "./url-safety";

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

const httpKeyProbe: KeyProbe = async (provider, apiKey, baseUrl) => {
  const target = PROBE_TARGETS[provider];
  try {
    // NFR-REL-09: bounded. This runs behind a spinner in the wizard with no way
    // to cancel, so a provider that accepts the connection and then says
    // nothing must not hang the setup indefinitely.
    const res = await fetch(target.url(baseUrl), {
      headers: target.headers(apiKey),
      signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { ok: false, error: "The provider did not respond. Check your connection and try again." };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

/** Buddy's own auth store — separate from Pi CLI's ~/.pi/agent/auth.json (NFR-AUTH-ISO). */
export function defaultAuthPath(): string {
  return (
    process.env.BUDDY_AUTH_PATH ??
    process.env[LEGACY_AUTH_PATH_ENV] ??
    join(homedir(), GLOBAL_CONFIG_DIR_NAME, AUTH_FILE_NAME)
  );
}

/**
 * The only way to build a ModelRuntime (NFR-SEC-14a).
 *
 * Every session must resolve credentials from buddy's own store. Commit
 * 231ac31 was a call site that omitted this: the SDK then fell back to the
 * global `~/.pi/` config and reflect ran against whatever provider happened to
 * be configured there — a different account, or none.
 */
export function createBuddyModelRuntime(): Promise<ModelRuntime> {
  return ModelRuntime.create({
    authPath: defaultAuthPath(),
    // NFR-SEC-19: both are required, not optional hygiene. Left unset, the SDK
    // defaults modelsPath to join(getAgentDir(), "models.json") — the Pi CLI's —
    // and modelsStorePath to its directory, so Buddy read the user's provider
    // definitions and cached its own catalogue inside another tool's config.
    modelsPath: buddyModelsPath(),
    modelsStorePath: buddyModelsStorePath(),
    // Both stated outright rather than left to a default, because the default
    // is not the same across SDK versions. In 0.80 `allowModelNetwork` falls
    // back to `PI_OFFLINE === undefined`, so it is on; by 0.83 the refresh only
    // runs when the option is explicitly true. Upgrading without this line
    // would silently stop refreshing the catalogue, and no test would notice.
    allowModelNetwork: true,
    // NFR-REL-09: the SDK's 15s is a CLI's patience, not an app's.
    modelRefreshTimeoutMs: MODEL_CATALOG_REFRESH_TIMEOUT_MS,
  });
}

/**
 * Validate the key with a probe call and, only if accepted, persist it into
 * the Pi auth store (merging with existing entries, 0600 permissions).
 */
export async function configureProviderKey(
  provider: ProviderId,
  apiKey: string,
  options: {
    baseUrl?: string;
    authPath?: string;
    probe?: KeyProbe;
    lookupFn?: DnsLookupFn;
  } = {},
): Promise<KeyCheck> {
  if (provider === "custom" && !options.baseUrl) {
    return { valid: false, error: "base URL required for OpenAI-compatible providers" };
  }

  // NFR-SEC-18: the custom base URL is the one destination in the app the user
  // types by hand, and the very next thing that happens is their API key being
  // sent to it in an Authorization header. A typo, or a URL pasted from
  // somewhere untrustworthy, would deliver the credential before anything else
  // got a chance to object.
  //
  // The rules are `assertSafeProviderBaseUrl`, not `assertSafeUrl` — loopback
  // and LAN addresses stay allowed here because Ollama and LM Studio are why
  // this field exists. See that function for why the threat model differs.
  if (provider === "custom") {
    try {
      await assertSafeProviderBaseUrl(options.baseUrl!, options.lookupFn);
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof UnsafeUrlError
            ? error.message
            : `Could not verify the base URL: ${String(error)}`,
      };
    }
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
 * Merge the key into buddy's auth.json. Entry shape matches pi-ai's
 * ApiKeyCredential ({ type: "api_key", key }) so the SDK reads it natively.
 *
 * NFR-REL-08: written atomically and under a lock. An unreadable store throws
 * rather than being replaced — the previous version treated any read failure as
 * "empty" and wrote only the new key, silently discarding every other
 * configured provider.
 */
function storeApiKey(authPath: string, piProvider: string, apiKey: string): void {
  updateStateFile<Record<string, unknown>>(
    authPath,
    (current) => ({ ...(current ?? {}), [piProvider]: { type: "api_key", key: apiKey } }),
    { mode: AUTH_FILE_MODE },
  );
}
