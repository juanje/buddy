// backends/auth-health.ts — OAuth credential health probes (FR-AUTH-01).

import { isAuthError, PROVIDER_REQUEST_TIMEOUT_MS } from "../shared/defaults";
import { WIZARD_PI_PROVIDERS } from "../shared/provider-mapping";
import { purgeStaleCredential, readStoredCredential } from "./provider-auth";

export type AuthProbeResult = { healthy: true } | { healthy: false; reason: string };

export interface ModelRuntimeProbeLike {
  getAvailable(providerId?: string): Promise<readonly unknown[]>;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The provider did not respond in time.")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Probe whether stored OAuth credentials still work for a provider. */
export async function probeProviderAuth(
  runtime: ModelRuntimeProbeLike,
  piProviderId: string,
  timeoutMs: number = PROVIDER_REQUEST_TIMEOUT_MS,
): Promise<AuthProbeResult> {
  try {
    await withTimeout(runtime.getAvailable(piProviderId), timeoutMs);
    return { healthy: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isAuthError(message)) {
      return { healthy: false, reason: message };
    }
    return { healthy: true };
  }
}

export interface OAuthHealthCheckDeps {
  readCredential?: (piProviderId: string) => string | undefined;
  purge?: (piProviderId: string, authPath?: string) => void;
  authPath?: string;
}

/**
 * Probe OAuth providers with stored credentials. Stale entries are purged and
 * their Pi provider ids returned for `needsReauth` reporting.
 */
export async function runOAuthHealthChecks(
  runtime: ModelRuntimeProbeLike,
  deps: OAuthHealthCheckDeps = {},
): Promise<Set<string>> {
  const readCredential = deps.readCredential ?? readStoredCredential;
  const purge = deps.purge ?? ((piProviderId) => purgeStaleCredential(piProviderId, deps.authPath));
  const needsReauth = new Set<string>();

  for (const piProviderId of WIZARD_PI_PROVIDERS) {
    const stored = readCredential(piProviderId);
    if (!stored || !/"type"\s*:\s*"oauth"/.test(stored)) continue;

    const probe = await probeProviderAuth(runtime, piProviderId);
    if (!probe.healthy) {
      purge(piProviderId);
      needsReauth.add(piProviderId);
    }
  }

  return needsReauth;
}
