// tests/unit/jira-actions.test.ts — FR-JIRA-02/03/05 Jira read actions.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  executeJiraAction,
  extractIssueKeys,
  formatIssueLine,
  issueToCacheEntry,
  jiraHelpText,
} from "../../backends/connectors/jira-actions";
import {
  readEntityStore,
  readQueryStore,
  readUserDirectory,
  writeEntityStore,
  writeQueryStore,
} from "../../backends/connectors/cache";
import { writeConnectorConfig } from "../../backends/connectors/credentials";

let rootDir: string;
let configDir: string;
let savedConfigDir: string | undefined;

const config = {
  enabled: true,
  baseUrl: "https://jira.example.com",
  email: "user@example.com",
  token: "secret",
  issueKeyPatterns: ["PROJ-\\d+"],
};

function mockFetch(body: unknown, status = 200) {
  return async (url: string) => {
    if (url.includes("/myself")) {
      return new Response(JSON.stringify({ accountId: "1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/user/search")) {
      return new Response(
        JSON.stringify([
          { accountId: "abc123", displayName: "Ozan Unsal", active: true },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/search/jql")) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/comment")) {
      return new Response(JSON.stringify({ comments: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/issue/")) {
      return new Response(
        JSON.stringify({
          key: "PROJ-1",
          fields: {
            summary: "Login bug",
            status: { name: "In Progress" },
            assignee: { displayName: "Alice" },
            priority: { name: "High" },
            updated: "2026-09-01T10:00:00Z",
            description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Details" }] }] },
            issuelinks: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };
}

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), "buddy-jira-actions-"));
  const home = mkdtempSync(join(tmpdir(), "buddy-jira-home-"));
  configDir = join(home, ".buddy");
  savedConfigDir = process.env.BUDDY_CONFIG_DIR;
  process.env.BUDDY_CONFIG_DIR = configDir;
  writeConnectorConfig("jira", config, configDir);
});

afterEach(() => {
  if (savedConfigDir === undefined) delete process.env.BUDDY_CONFIG_DIR;
  else process.env.BUDDY_CONFIG_DIR = savedConfigDir;
  rmSync(rootDir, { recursive: true, force: true });
});

describe("jira actions (FR-JIRA-02/03/05)", () => {
  it("help lists actions", async () => {
    const result = await executeJiraAction(rootDir, "help");
    expect(result.data).toContain("board");
    expect(jiraHelpText()).toContain("issue_detail");
  });

  it("unknown action returns error with help suggestion", async () => {
    const result = await executeJiraAction(rootDir, "unknown_action", {}, { config });
    expect(result.error?.suggestion).toContain("help");
  });

  it("board fetches and caches issues", async () => {
    const fetchImpl = mockFetch({
      issues: [
        {
          key: "PROJ-1",
          fields: {
            summary: "Task",
            status: { name: "Open" },
            assignee: { displayName: "Bob" },
            priority: { name: "Medium" },
            updated: "2026-09-05T12:00:00Z",
          },
        },
      ],
    });
    const result = await executeJiraAction(rootDir, "board", {}, { fetchImpl, config });
    expect(result.data).toContain("PROJ-1");
    expect(result.stale).toBe(false);
    expect(readEntityStore(rootDir, "jira")["PROJ-1"]?.summary).toBe("Task");
    expect(readQueryStore(rootDir, "jira", "board")?.keys).toEqual(["PROJ-1"]);
  });

  it("force refresh bypasses fresh cache", async () => {
    writeEntityStore(rootDir, "jira", {
      "PROJ-1": issueToCacheEntry(
        {
          key: "PROJ-1",
          fields: {
            summary: "Cached",
            status: { name: "Open" },
            assignee: { displayName: "Bob" },
            updated: new Date().toISOString(),
          },
        },
        "15m",
      ),
    });
    let fetchCount = 0;
    const fetchImpl = async (url: string) => {
      fetchCount++;
      return mockFetch({
        issues: [
          {
            key: "PROJ-2",
            fields: {
              summary: "Fresh",
              status: { name: "Open" },
              assignee: { displayName: "Bob" },
              updated: new Date().toISOString(),
            },
          },
        ],
      })(url);
    };
    const result = await executeJiraAction(rootDir, "board", { force: true }, { fetchImpl, config });
    expect(fetchCount).toBeGreaterThan(0);
    expect(result.data).toContain("PROJ-2");
  });

  it("serves stale cache when offline", async () => {
    const syncedAt = new Date(Date.now() - 20 * 60_000).toISOString();
    writeEntityStore(rootDir, "jira", {
      "PROJ-1": {
        synced_at: syncedAt,
        stale_after: "15m",
        key: "PROJ-1",
        summary: "Old task",
        status: "Open",
        assignee: "Bob",
      },
    });
    writeQueryStore(rootDir, "jira", "board", {
      keys: ["PROJ-1"],
      synced_at: syncedAt,
      stale_after: "15m",
    });
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    const result = await executeJiraAction(rootDir, "board", {}, { fetchImpl, config });
    expect(result.stale).toBe(true);
    expect(result.data).toContain("PROJ-1");
  });

  it("extracts issue keys from text using config patterns", () => {
    expect(extractIssueKeys("Fix PROJ-42 and proj-99", ["PROJ-\\d+"])).toEqual(["PROJ-42", "PROJ-99"]);
  });

  it("formats issue lines for display", () => {
    const line = formatIssueLine({
      synced_at: "x",
      stale_after: "15m",
      key: "PROJ-1",
      summary: "Bug",
      status: "Open",
      assignee: "Alice",
    });
    expect(line).toContain("PROJ-1");
    expect(line).toContain("Bug");
  });

  it("board resolves assignee name to accountId", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push(url);
      return mockFetch({
        issues: [
          {
            key: "PROJ-5",
            fields: {
              summary: "Ozan task",
              status: { name: "Open" },
              assignee: { displayName: "Ozan Unsal" },
              updated: "2026-09-06T10:00:00Z",
            },
          },
        ],
      })(url, init);
    };
    const result = await executeJiraAction(
      rootDir, "board", { assignee: "Ozan" }, { fetchImpl, config },
    );
    expect(result.data).toContain("PROJ-5");
    const jqlCall = calls.find((c) => c.includes("/search/jql"));
    expect(jqlCall).toBeDefined();
  });

  it("my_issues accepts assignee to query another person", async () => {
    const fetchImpl = mockFetch({
      issues: [
        {
          key: "PROJ-7",
          fields: {
            summary: "Ozan open issue",
            status: { name: "To Do" },
            assignee: { displayName: "Ozan Unsal" },
            updated: "2026-09-06T10:00:00Z",
          },
        },
      ],
    });
    const result = await executeJiraAction(
      rootDir, "my_issues", { assignee: "Ozan" }, { fetchImpl, config },
    );
    expect(result.data).toContain("PROJ-7");
  });

  it("returns error when no user matches", async () => {
    const fetchImpl = async (url: string) => {
      if (url.includes("/user/search")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return mockFetch({ issues: [] })(url);
    };
    const result = await executeJiraAction(
      rootDir, "board", { assignee: "nobody" }, { fetchImpl, config },
    );
    expect(result.error).toBeDefined();
    expect(result.error!.error).toContain("No Jira user found");
  });

  it("caches resolved users in user directory", async () => {
    const fetchImpl = mockFetch({ issues: [] });
    await executeJiraAction(
      rootDir, "board", { assignee: "Ozan" }, { fetchImpl, config },
    );
    const dir = readUserDirectory(rootDir, "jira");
    expect(dir["ozan unsal"]).toBeDefined();
    expect(dir["ozan unsal"]!.accountId).toBe("abc123");
  });

  it("resolves from local directory without API call", async () => {
    // First call populates the directory
    const apiCalls: string[] = [];
    const trackingFetch = async (url: string, init?: RequestInit) => {
      apiCalls.push(url);
      return mockFetch({ issues: [] })(url, init);
    };
    await executeJiraAction(
      rootDir, "board", { assignee: "Ozan" }, { fetchImpl: trackingFetch, config },
    );
    const firstCallCount = apiCalls.filter((u) => u.includes("/user/search")).length;
    expect(firstCallCount).toBe(1);

    // Second call should use cached directory
    apiCalls.length = 0;
    await executeJiraAction(
      rootDir, "board", { assignee: "Ozan Unsal" }, { fetchImpl: trackingFetch, config },
    );
    const secondCallCount = apiCalls.filter((u) => u.includes("/user/search")).length;
    expect(secondCallCount).toBe(0);
  });

  it("learns users passively from fetched issues", async () => {
    const fetchImpl = mockFetch({
      issues: [
        {
          key: "PROJ-10",
          fields: {
            summary: "Alice task",
            status: { name: "Open" },
            assignee: { accountId: "alice-id", displayName: "Alice Wonderland" },
            updated: "2026-09-06T10:00:00Z",
          },
        },
      ],
    });
    await executeJiraAction(rootDir, "my_issues", {}, { fetchImpl, config });
    const dir = readUserDirectory(rootDir, "jira");
    expect(dir["alice wonderland"]).toBeDefined();
    expect(dir["alice wonderland"]!.accountId).toBe("alice-id");
  });
});
