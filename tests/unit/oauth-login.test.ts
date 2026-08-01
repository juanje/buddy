// tests/unit/oauth-login.test.ts — OAuthService with mock ModelRuntime (FR-SETUP-05).

import { describe, expect, it, vi } from "vitest";

import { OAuthService, type OAuthModelRuntimeLike } from "../../backends/oauth-service";
import type { OAuthUIEvent } from "../../shared/api";

function makeRuntime(
  loginImpl?: OAuthModelRuntimeLike["login"],
): OAuthModelRuntimeLike {
  return {
    login: loginImpl ?? (async () => undefined),
    hasConfiguredAuth: () => false,
    getProviderAuthStatus: () => ({ configured: false }),
  };
}

function assertPrompt(
  event: OAuthUIEvent | undefined,
): asserts event is Extract<OAuthUIEvent, { type: "prompt" }> {
  if (!event || event.type !== "prompt") throw new Error("expected prompt event");
}

describe("OAuthService — the SDK's post-login refresh can hang", () => {
  // Reported from real use, twice. `runtime.login()` contains the whole
  // interactive flow: it opens the browser and waits for the person. After
  // the token exchange it runs an unbounded model-catalogue refresh (no
  // signal, no timeout — a different code path from the one bounded at
  // startup), which a stalled `pi.dev` hangs forever. The user sees Pi's own
  // success page and an app still saying "Waiting for browser".
  //
  // The first attempt at this raced a fixed 5s timeout against the whole
  // call, which raced the human instead: a real OpenAI login that succeeded
  // was reported as an error, and an Anthropic login was reported as
  // connected on the strength of a credential that was already there before
  // it started. Both directions are pinned below.

  const CRED_OPTS = { credentialPollMs: 5, postCredentialGraceMs: 5 };

  it("reports success once this attempt's credential lands, even if login never returns", async () => {
    let stored: string | undefined;
    const service = new OAuthService(
      makeRuntime(() => {
        // The browser step finishes and writes a credential; the refresh after
        // it never resolves.
        setTimeout(() => (stored = '{"type":"oauth","expires":2}'), 10);
        return new Promise(() => {});
      }),
      { onEvent: () => {} },
      { ...CRED_OPTS, readCredential: () => stored },
    );

    await expect(service.login("openai")).resolves.toEqual({ success: true });
  });

  it("keeps waiting while the user is still in the browser", async () => {
    // No credential ever appears: the guard must not invent an outcome, since
    // that is indistinguishable from a person taking their time.
    const service = new OAuthService(
      makeRuntime(() => new Promise(() => {})),
      { onEvent: () => {} },
      { ...CRED_OPTS, readCredential: () => undefined },
    );

    const settled = await Promise.race([
      service.login("openai").then(() => "settled" as const),
      new Promise<"still-waiting">((resolve) => setTimeout(() => resolve("still-waiting"), 60)),
    ]);
    expect(settled).toBe("still-waiting");
  });

  it("does not treat a credential that was already there as this login's success", async () => {
    // The Anthropic false positive: a valid credential from an earlier session
    // must not make an unfinished login look connected.
    const existing = '{"type":"oauth","expires":1}';
    const service = new OAuthService(
      makeRuntime(() => new Promise(() => {})),
      { onEvent: () => {} },
      { ...CRED_OPTS, readCredential: () => existing },
    );

    const settled = await Promise.race([
      service.login("anthropic").then(() => "settled" as const),
      new Promise<"still-waiting">((resolve) => setTimeout(() => resolve("still-waiting"), 60)),
    ]);
    expect(settled).toBe("still-waiting");
  });

  it("still returns normally when login resolves on its own", async () => {
    const service = new OAuthService(
      makeRuntime(async () => undefined),
      { onEvent: () => {} },
      { ...CRED_OPTS, readCredential: () => undefined },
    );
    await expect(service.login("openai")).resolves.toEqual({ success: true });
  });

  it("does not crash when the abandoned login rejects after the credential landed", async () => {
    let stored: string | undefined;
    let rejectLogin!: (err: Error) => void;
    const service = new OAuthService(
      makeRuntime(() => {
        setTimeout(() => (stored = '{"type":"oauth","expires":2}'), 5);
        return new Promise((_resolve, reject) => (rejectLogin = reject));
      }),
      { onEvent: () => {} },
      { ...CRED_OPTS, readCredential: () => stored },
    );

    await service.login("openai");
    rejectLogin(new Error("late failure from the stuck refresh"));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});

describe("OAuthService", () => {
  it("forwards auth_url events to the frontend callback", async () => {
    const events: OAuthUIEvent[] = [];
    const service = new OAuthService(
      makeRuntime(async (_provider, _type, interaction) => {
        interaction.notify({ type: "auth_url", url: "https://example.com/auth" });
      }),
      { onEvent: (e) => events.push(e) },
    );

    const result = await service.login("openai");
    expect(result).toEqual({ success: true });
    expect(events.some((e) => e.type === "auth_url" && e.url === "https://example.com/auth")).toBe(
      true,
    );
    expect(events.some((e) => e.type === "complete")).toBe(true);
  });

  it("returns failure when login throws, and reports it as an error event", async () => {
    const events: OAuthUIEvent[] = [];
    const service = new OAuthService(
      makeRuntime(async () => {
        throw new Error("network down");
      }),
      { onEvent: (e) => events.push(e) },
    );

    const result = await service.login("anthropic");
    expect(result).toEqual({ success: false, cancelled: false, error: "network down" });
    expect(events.some((e) => e.type === "error")).toBe(true);
  });

  it("rejects OAuth for google (API key only)", async () => {
    const login = vi.fn();
    const service = new OAuthService(makeRuntime(login), { onEvent: () => {} });

    const result = await service.login("google");
    expect(result.success).toBe(false);
    expect(login).not.toHaveBeenCalled();
  });

  it("answers pending prompts via answerPrompt", async () => {
    const events: OAuthUIEvent[] = [];
    const service = new OAuthService(
      makeRuntime(async (_provider, _type, interaction) => {
        const answer = await interaction.prompt({
          type: "select",
          message: "Pick account",
          options: ["a", "b"],
        });
        expect(answer).toBe("b");
      }),
      { onEvent: (e) => events.push(e) },
    );

    const loginPromise = service.login("openai");
    await new Promise((r) => setTimeout(r, 0));
    const prompt = events.find((e) => e.type === "prompt");
    assertPrompt(prompt);
    service.answerPrompt(prompt.requestId, "b");
    await expect(loginPromise).resolves.toEqual({ success: true });
  });

  it("reports a cancelled login as cancelled, whatever the message says", async () => {
    const events: OAuthUIEvent[] = [];
    const service = new OAuthService(
      // The rejection message is deliberately not the string the old code
      // matched on: cancellation is decided by the abort signal, so a reworded
      // SDK message or a localized build must not turn it into an error.
      makeRuntime(async (_provider, _type, interaction) => {
        await new Promise((_resolve, reject) => {
          interaction.signal?.addEventListener("abort", () => reject(new Error("aborted by user")));
        });
      }),
      { onEvent: (e) => events.push(e) },
    );

    const loginPromise = service.login("openai");
    service.cancel();
    const result = await loginPromise;

    expect(result).toEqual({ success: false, cancelled: true, error: "aborted by user" });
    // FR-SETUP-05: no error surfaces for a cancellation.
    expect(events.some((e) => e.type === "error")).toBe(false);
  });
});
