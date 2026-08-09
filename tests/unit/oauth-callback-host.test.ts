// tests/unit/oauth-callback-host.test.ts — Windows OAuth localhost/::1 bind.

import { describe, expect, it } from "vitest";

import { applyWindowsOAuthCallbackHost } from "../../backends/oauth-callback-host";

describe("applyWindowsOAuthCallbackHost", () => {
  it("sets PI_OAUTH_CALLBACK_HOST to :: on win32 when unset", () => {
    const env: NodeJS.ProcessEnv = {};
    applyWindowsOAuthCallbackHost("win32", env);
    expect(env.PI_OAUTH_CALLBACK_HOST).toBe("::");
  });

  it("does not override an explicit host", () => {
    const env: NodeJS.ProcessEnv = { PI_OAUTH_CALLBACK_HOST: "127.0.0.1" };
    applyWindowsOAuthCallbackHost("win32", env);
    expect(env.PI_OAUTH_CALLBACK_HOST).toBe("127.0.0.1");
  });

  it("is a no-op on linux", () => {
    const env: NodeJS.ProcessEnv = {};
    applyWindowsOAuthCallbackHost("linux", env);
    expect(env.PI_OAUTH_CALLBACK_HOST).toBeUndefined();
  });
});
