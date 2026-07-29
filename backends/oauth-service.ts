// backends/oauth-service.ts — Pi SDK OAuth login wrapper (FR-SETUP-05).

import type { OAuthUIEvent, OAuthLoginResult, SetupProviderId } from "../shared/api";
import { supportsOAuth } from "../shared/provider-constants";
import { toPiProviderId } from "../shared/provider-mapping";

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

export class OAuthService {
  private abortController: AbortController | undefined;
  private nextPromptId = 0;
  private pendingPrompts = new Map<number, PendingPrompt>();

  constructor(
    private runtime: OAuthModelRuntimeLike,
    private callbacks: OAuthServiceCallbacks,
  ) {}

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

  async login(provider: SetupProviderId): Promise<OAuthLoginResult> {
    if (!supportsOAuth(provider)) {
      return { success: false, cancelled: false, error: "OAuth not supported for this provider" };
    }

    this.cancel();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const piProvider = toPiProviderId(provider);
      await this.runtime.login(piProvider, "oauth", {
        signal,
        notify: (event) => this.forwardNotify(event),
        prompt: (prompt) => this.forwardPrompt(prompt),
      });
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
