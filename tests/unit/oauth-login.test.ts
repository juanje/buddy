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

  it("returns failure when login throws", async () => {
    const service = new OAuthService(
      makeRuntime(async () => {
        throw new Error("network down");
      }),
      { onEvent: () => {} },
    );

    const result = await service.login("anthropic");
    expect(result).toEqual({ success: false, error: "network down" });
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

  it("cancels an in-flight login", async () => {
    const service = new OAuthService(
      makeRuntime(async (_provider, _type, interaction) => {
        await new Promise((_resolve, reject) => {
          interaction.signal?.addEventListener("abort", () => reject(new Error("Login cancelled")));
        });
      }),
      { onEvent: () => {} },
    );

    const loginPromise = service.login("openai");
    service.cancel();
    const result = await loginPromise;
    expect(result).toEqual({ success: false, error: "Login cancelled" });
  });
});
