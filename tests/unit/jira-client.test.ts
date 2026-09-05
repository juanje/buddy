// tests/unit/jira-client.test.ts — FR-JIRA-01/05 Jira REST client.

import { describe, expect, it } from "vitest";

import {
  buildJiraAuthHeader,
  createJiraClient,
  JiraClientError,
  mapJiraHttpError,
  mapNetworkError,
  normalizeJiraBaseUrl,
  testJiraConnection,
} from "../../backends/connectors/jira-client";

describe("jira client (FR-JIRA-01/05)", () => {
  it("builds Basic auth header from email and token", () => {
    const header = buildJiraAuthHeader("user@example.com", "secret-token");
    expect(header).toBe(`Basic ${Buffer.from("user@example.com:secret-token").toString("base64")}`);
  });

  it("normalizes base URL trailing slashes", () => {
    expect(normalizeJiraBaseUrl("https://jira.example.com/")).toBe("https://jira.example.com");
  });

  it("maps HTTP status codes to ConnectorError", () => {
    expect(mapJiraHttpError(401).code).toBe(401);
    expect(mapJiraHttpError(403).recoverable).toBe(false);
    expect(mapJiraHttpError(404).suggestion).toContain("deleted");
    expect(mapJiraHttpError(429).recoverable).toBe(true);
    expect(mapJiraHttpError(503).recoverable).toBe(true);
  });

  it("maps network timeout to recoverable error", () => {
    const err = mapNetworkError(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    expect(err.recoverable).toBe(true);
  });

  it("searchJql sends auth header and parses response", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ issues: [{ key: "PROJ-1", fields: { summary: "Test" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createJiraClient(
      { baseUrl: "https://jira.example.com", email: "a@b.com", token: "tok" },
      { fetchImpl },
    );
    const result = await client.searchJql("project = PROJ", ["summary"]);
    expect(result.issues[0]?.key).toBe("PROJ-1");
    expect(calls[0]?.url).toBe("https://jira.example.com/rest/api/3/search/jql");
    expect((calls[0]?.init?.headers as Record<string, string>).authorization).toMatch(/^Basic /);
  });

  it("throws JiraClientError on 401", async () => {
    const fetchImpl = async () => new Response("nope", { status: 401 });
    const client = createJiraClient(
      { baseUrl: "https://jira.example.com", email: "a@b.com", token: "bad" },
      { fetchImpl },
    );
    await expect(client.request("/rest/api/3/myself")).rejects.toBeInstanceOf(JiraClientError);
  });

  it("testJiraConnection returns ok on success", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ accountId: "x" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const result = await testJiraConnection(
      { baseUrl: "https://jira.example.com", email: "a@b.com", token: "tok" },
      { fetchImpl },
    );
    expect(result.ok).toBe(true);
  });
});
