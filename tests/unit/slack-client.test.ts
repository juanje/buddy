// tests/unit/slack-client.test.ts — FR-SLACK-01 Slack Web API client.

import { describe, expect, it } from "vitest";

import {
  createSlackClient,
  mapSlackApiError,
  mapSlackHttpError,
  mapNetworkError,
  SlackClientError,
  testSlackConnection,
} from "../../backends/connectors/slack-client";

describe("slack client (FR-SLACK-01)", () => {
  it("maps Slack API auth errors to suggestion keys", () => {
    expect(mapSlackApiError("invalid_auth").suggestion).toBe("slackError401");
    expect(mapSlackApiError("missing_scope").suggestion).toBe("slackError403");
    expect(mapSlackApiError("channel_not_found").suggestion).toBe("slackError404");
    expect(mapSlackApiError("ratelimited").suggestion).toBe("slackError429");
  });

  it("maps HTTP status codes to ConnectorError suggestion keys", () => {
    expect(mapSlackHttpError(401).suggestion).toBe("slackError401");
    expect(mapSlackHttpError(429).recoverable).toBe(true);
    expect(mapSlackHttpError(503).suggestion).toBe("slackError5xx");
  });

  it("maps network timeout to recoverable error key", () => {
    const err = mapNetworkError(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    expect(err.recoverable).toBe(true);
    expect(err.suggestion).toBe("slackErrorTimeout");
  });

  it("authTest sends bearer token and cookie headers", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, user: "alice", team: "T" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createSlackClient(
      { token: "xoxc-tok", cookie: "xoxd-cookie" },
      { fetchImpl },
    );
    const result = await client.authTest();
    expect(result.user).toBe("alice");
    expect(calls[0]?.url).toBe("https://slack.com/api/auth.test");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer xoxc-tok");
    expect(headers.cookie).toBe("d=xoxd-cookie");
  });

  it("throws SlackClientError on API ok:false", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ ok: false, error: "invalid_auth" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const client = createSlackClient({ token: "xoxc", cookie: "xoxd" }, { fetchImpl });
    await expect(client.authTest()).rejects.toBeInstanceOf(SlackClientError);
  });

  it("testSlackConnection returns ok on success", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ ok: true, user: "u" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const result = await testSlackConnection({ token: "xoxc", cookie: "xoxd" }, { fetchImpl });
    expect(result.ok).toBe(true);
  });
});
