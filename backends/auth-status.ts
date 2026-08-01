// backends/auth-status.ts — which providers Buddy can already talk to.
//
// Extracted out of agent-worker.ts's `main()`: the body of the `getAuthStatus`
// RPC handler touched nothing of the worker's own state, only the
// `ModelRuntime` it was handed. A function with no closure over `main()`'s
// mutable state is safe to pull out on its own — no call-site restructuring,
// no risk to the things around it — and it is directly testable against a
// fake runtime, which the RPC handler never was.

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import type { AuthStatusResult, SetupConfig } from "../shared/api";
import { fromPiProviderId, WIZARD_PI_PROVIDERS } from "../shared/provider-mapping";

/** The setup wizard's view of auth state for every provider Buddy offers. */
export function buildAuthStatus(runtime: ModelRuntime): AuthStatusResult {
  const providers = WIZARD_PI_PROVIDERS.map((piProviderId) => {
    const buddyProvider = fromPiProviderId(piProviderId);
    const status = runtime.getProviderAuthStatus(piProviderId);
    return {
      piProviderId,
      buddyProvider: buddyProvider ?? ("openai" as SetupConfig["provider"]),
      hasAuth: status.configured,
      authType: status.configured
        ? runtime.isUsingOAuth(piProviderId)
          ? ("oauth" as const)
          : ("api_key" as const)
        : undefined,
    };
  }).filter((p) => p.buddyProvider);
  return { providers };
}
