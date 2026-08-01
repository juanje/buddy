// backends/auth-status.ts — which providers Buddy can already talk to.
//
// Extracted out of agent-worker.ts's `main()`: the body of the `getAuthStatus`
// RPC handler touched nothing of the worker's own state, only the
// `ModelRuntime` it was handed.
//
// It asks two sources, and the second is not redundancy. `ModelRuntime`
// answers from an in-memory snapshot that only updates when its own
// `refresh()` completes — and that refresh is the call a stalled `pi.dev` can
// hang indefinitely (FR-SETUP-05). A user who signs in successfully while it
// is hung has a credential on disk and a runtime that has not noticed:
// reported from real use as a provider that worked, showed its models, and
// then disappeared from Settings for the rest of the session. Buddy's own
// auth.json is written by the login itself, so it knows first.

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import type { AuthStatusResult, SetupConfig } from "../shared/api";
import { fromPiProviderId, WIZARD_PI_PROVIDERS } from "../shared/provider-mapping";
import { readStoredCredential } from "./provider-auth";

export interface AuthStatusDeps {
  /** Buddy's own record of a stored credential. Injected for tests. */
  readCredential?: (piProviderId: string) => string | undefined;
}

/** The setup wizard's and Settings' view of auth state for every provider. */
export function buildAuthStatus(runtime: ModelRuntime, deps: AuthStatusDeps = {}): AuthStatusResult {
  const readCredential = deps.readCredential ?? readStoredCredential;

  const providers = WIZARD_PI_PROVIDERS.map((piProviderId) => {
    const buddyProvider = fromPiProviderId(piProviderId);
    const status = runtime.getProviderAuthStatus(piProviderId);
    // Additive on purpose: the runtime knows about credential sources Buddy's
    // own store does not (runtime API keys, environment variables), so it is
    // never overruled — only supplemented when it has not caught up.
    const stored = status.configured ? undefined : readCredential(piProviderId);
    const hasAuth = status.configured || stored !== undefined;

    return {
      piProviderId,
      buddyProvider: buddyProvider ?? ("openai" as SetupConfig["provider"]),
      hasAuth,
      authType: hasAuth ? authTypeOf(runtime, piProviderId, status.configured, stored) : undefined,
    };
  }).filter((p) => p.buddyProvider);

  return { providers };
}

function authTypeOf(
  runtime: ModelRuntime,
  piProviderId: string,
  runtimeKnows: boolean,
  stored: string | undefined,
): "oauth" | "api_key" {
  if (runtimeKnows) return runtime.isUsingOAuth(piProviderId) ? "oauth" : "api_key";
  // Falling back to the stored entry, whose shape is `{ "type": "oauth" | ... }`.
  return stored !== undefined && /"type"\s*:\s*"oauth"/.test(stored) ? "oauth" : "api_key";
}
