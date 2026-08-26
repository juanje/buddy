// tests/unit/auth-error-detection.test.ts — FR-AUTH-02 auth error classification.

import { describe, expect, it } from "vitest";

import {
  detectAuthErrorInEvents,
  extractAuthErrorFromEvents,
  providerFromAuthMessage,
  toAuthErrorEvent,
} from "../../backends/auth-error";
import { isAuthError } from "../../shared/defaults";
import type { AgentEvent } from "../../shared/api";

describe("isAuthError", () => {
  it("classifies OAuth refresh failures as auth errors", () => {
    expect(isAuthError("OAuth refresh failed for anthropic")).toBe(true);
  });

  it("classifies invalid_grant as auth errors", () => {
    expect(isAuthError("invalid_grant: refresh token expired")).toBe(true);
  });

  it("does not classify rate limits as auth errors", () => {
    expect(isAuthError("429 rate limit exceeded")).toBe(false);
  });
});

describe("detectAuthErrorInEvents", () => {
  it("finds message_end with auth stopReason error", () => {
    const events: AgentEvent[] = [
      {
        type: "message_end",
        message: {
          role: "assistant",
          stopReason: "error",
          errorMessage: "OAuth refresh failed for anthropic",
        },
      } as AgentEvent,
    ];
    expect(detectAuthErrorInEvents(events)).toBe("OAuth refresh failed for anthropic");
    expect(extractAuthErrorFromEvents(events)).toBe("OAuth refresh failed for anthropic");
  });

  it("ignores non-auth assistant errors", () => {
    const events: AgentEvent[] = [
      {
        type: "message_end",
        message: {
          role: "assistant",
          stopReason: "error",
          errorMessage: "context length exceeded",
        },
      } as AgentEvent,
    ];
    expect(detectAuthErrorInEvents(events)).toBeUndefined();
  });
});

describe("providerFromAuthMessage", () => {
  it("maps provider id from error text", () => {
    expect(providerFromAuthMessage("OAuth refresh failed for anthropic")).toBe("anthropic");
    expect(providerFromAuthMessage("No API key found for openai-codex")).toBe("openai");
  });
});

describe("toAuthErrorEvent", () => {
  it("builds an AuthErrorEvent", () => {
    expect(toAuthErrorEvent("OAuth refresh failed for anthropic")).toEqual({
      provider: "anthropic",
      message: "OAuth refresh failed for anthropic",
    });
  });
});
