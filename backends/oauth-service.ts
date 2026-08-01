// backends/oauth-service.ts — Pi SDK OAuth login wrapper (FR-SETUP-05).

import type { OAuthUIEvent, OAuthLoginResult, SetupProviderId } from "../shared/api";
import { readStoredCredential } from "./provider-auth";
import { supportsOAuth } from "../shared/provider-constants";
import { toPiProviderId } from "../shared/provider-mapping";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AuthPromptLike = {
  type: string;
  message: string;
  placeholder?: string;
  options?: readonly unknown[] | string[];
  signal?: AbortSignal;
};

type AuthEventLike = {
  type: string;
  url?: string;
  instructions?: string;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  links?: unknown;
};

export interface OAuthModelRuntimeLike {
  login(
    providerId: string,
    type: string,
    interaction: {
      signal?: AbortSignal;
      prompt: (prompt: AuthPromptLike) => Promise<string>;
      notify: (event: AuthEventLike) => void;
    },
  ): Promise<unknown>;
  hasConfiguredAuth(providerId: string): boolean;
  getProviderAuthStatus(providerId: string): { configured: boolean; type?: string };
}

interface PendingPrompt {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
}

export interface OAuthServiceCallbacks {
  onEvent: (event: OAuthUIEvent) => void;
}

export interface OAuthServiceOptions {
  /**
   * How long to keep waiting for `login()` *after* the credential has already
   * been written to disk.
   *
   * Not a bound on the login itself. `runtime.login()` contains the entire
   * interactive flow — it opens the browser and waits for the user, which
   * takes as long as a human takes — so any fixed timeout over the whole call
   * races the person using it. What is bounded here is only the tail: the
   * installed SDK follows a successful token exchange with
   * `await this.refresh({ allowNetwork })`, a call that takes no signal and no
   * timeout, so a stalled `pi.dev` hangs it forever (the same host behind the
   * NFR-PERF-02 startup fix; `modelRefreshTimeoutMs` on `create()` does not
   * reach this path). Once the credential is on disk the exchange is done and
   * only that refresh can still be running.
   */
  postCredentialGraceMs?: number;
  /** How often to check whether the credential has landed. */
  credentialPollMs?: number;
  /**
   * The stored credential for a provider, as an opaque comparable value.
   * Defaults to Buddy's own auth store. Injected for tests.
   */
  readCredential?: (piProviderId: string) => string | undefined;
}

const DEFAULT_POST_CREDENTIAL_GRACE_MS = 3_000;
const DEFAULT_CREDENTIAL_POLL_MS = 250;

export class OAuthService {
  private abortController: AbortController | undefined;
  private nextPromptId = 0;
  private pendingPrompts = new Map<number, PendingPrompt>();
  private readonly postCredentialGraceMs: number;
  private readonly credentialPollMs: number;
  private readonly readCredential: (piProviderId: string) => string | undefined;

  constructor(
    private runtime: OAuthModelRuntimeLike,
    private callbacks: OAuthServiceCallbacks,
    options: OAuthServiceOptions = {},
  ) {
    this.postCredentialGraceMs = options.postCredentialGraceMs ?? DEFAULT_POST_CREDENTIAL_GRACE_MS;
    this.credentialPollMs = options.credentialPollMs ?? DEFAULT_CREDENTIAL_POLL_MS;
    this.readCredential = options.readCredential ?? readStoredCredential;
  }

  answerPrompt(requestId: number, value: string): void {
    const pending = this.pendingPrompts.get(requestId);
    if (!pending) return;
    this.pendingPrompts.delete(requestId);
    pending.resolve(value);
  }

  cancel(): void {
    this.abortController?.abort();
    for (const [, pending] of this.pendingPrompts) {
      pending.reject(new Error("Login cancelled"));
    }
    this.pendingPrompts.clear();
  }

  /**
   * Resolve once this attempt's credential is on disk and the SDK still has
   * not returned — never before that, so the user's time in the browser is
   * not raced. Never resolves if no credential appears: waiting is then the
   * correct behaviour, exactly as before this guard existed.
   */
  private async waitForCredential(
    piProvider: string,
    signal: AbortSignal,
  ): Promise<"credential-stored"> {
    const before = this.readCredential(piProvider);
    for (;;) {
      await sleep(this.credentialPollMs);
      if (signal.aborted) return new Promise<never>(() => {}); // cancel() owns the outcome
      const now = this.readCredential(piProvider);
      if (now !== undefined && now !== before) {
        // The exchange is done. Give the SDK's own tail a moment to finish
        // normally before concluding it is stuck.
        await sleep(this.postCredentialGraceMs);
        return "credential-stored";
      }
    }
  }

  async login(provider: SetupProviderId): Promise<OAuthLoginResult> {
    if (!supportsOAuth(provider)) {
      return { success: false, cancelled: false, error: "OAuth not supported for this provider" };
    }

    this.cancel();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const piProvider = toPiProviderId(provider);

    try {
      const loginCall = this.runtime.login(piProvider, "oauth", {
        signal,
        notify: (event) => this.forwardNotify(event),
        prompt: (prompt) => this.forwardPrompt(prompt),
      });
      // If this rejects after the race below already timed out, there is no
      // one left awaiting it — an unhandled rejection would otherwise crash
      // the worker over a login the user has already been answered about.
      loginCall.catch(() => {});

      const outcome = await Promise.race([
        loginCall.then(() => "logged-in" as const),
        this.waitForCredential(piProvider, signal),
      ]);

      if (outcome === "credential-stored") {
        // Not a cancellation and not a guess: the credential this attempt
        // produced is on disk, so the token exchange finished. Only the
        // SDK's own unbounded refresh can still be running, and nothing can
        // stop it — so stop waiting for it rather than reporting a failure
        // for a login that succeeded.
        this.callbacks.onEvent({ type: "complete" });
        return { success: true };
      }

      this.callbacks.onEvent({ type: "complete" });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // `signal.aborted` is what actually knows the user cancelled: this
      // controller belongs to this login attempt and only `cancel()` aborts it.
      // The message was standing in for it, which made an English sentence a
      // status code (FR-SETUP-05).
      const cancelled = signal.aborted;
      if (!cancelled) {
        this.callbacks.onEvent({ type: "error", message });
      }
      return { success: false, cancelled, error: message };
    } finally {
      this.abortController = undefined;
    }
  }

  private forwardNotify(event: AuthEventLike): void {
    switch (event.type) {
      case "auth_url":
        this.callbacks.onEvent({
          type: "auth_url",
          url: event.url ?? "",
          instructions: event.instructions,
        });
        break;
      case "device_code":
        this.callbacks.onEvent({
          type: "device_code",
          userCode: event.userCode ?? "",
          verificationUri: event.verificationUri ?? "",
          message: event.message,
        });
        break;
      case "info":
        this.callbacks.onEvent({ type: "info", message: event.message ?? "" });
        break;
      default:
        this.callbacks.onEvent({ type: "progress", message: event.message ?? event.type });
    }
  }

  private forwardPrompt(prompt: AuthPromptLike): Promise<string> {
    if (this.canAutoAnswer(prompt)) {
      return Promise.resolve(this.autoAnswer(prompt));
    }

    const requestId = ++this.nextPromptId;
    return new Promise((resolve, reject) => {
      this.pendingPrompts.set(requestId, { resolve, reject });
      this.callbacks.onEvent({
        type: "prompt",
        requestId,
        promptType: prompt.type,
        message: prompt.message,
        options: prompt.options?.map((opt) =>
          typeof opt === "string" ? opt : String((opt as { id?: string; label?: string }).id ?? opt),
        ),
        placeholder: prompt.placeholder,
      });
      prompt.signal?.addEventListener(
        "abort",
        () => {
          this.pendingPrompts.delete(requestId);
          reject(new Error("Login cancelled"));
        },
        { once: true },
      );
    });
  }

  /**
   * Desktop app always uses browser auth — auto-answer the SDK's "select
   * login method" prompt without showing it to the user.
   */
  private canAutoAnswer(prompt: AuthPromptLike): boolean {
    if (prompt.type !== "select" || !prompt.options) return false;
    const opts = prompt.options.map((o) =>
      typeof o === "string" ? o : String((o as { id?: string }).id ?? o),
    );
    return opts.includes("browser");
  }

  private autoAnswer(prompt: AuthPromptLike): string {
    const opts = (prompt.options ?? []).map((o) =>
      typeof o === "string" ? o : String((o as { id?: string }).id ?? o),
    );
    return opts.find((o) => o === "browser") ?? opts[0] ?? "";
  }
}
