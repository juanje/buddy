// tests/unit/slack-actions.test.ts — FR-SLACK-01..03 Slack read actions.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { executeSlackAction, slackHelpText } from "../../backends/connectors/slack-actions";
import { readEntityStore } from "../../backends/connectors/cache";
import { readSlackUserCache } from "../../backends/connectors/slack-users";
import { writeConnectorConfig } from "../../backends/connectors/credentials";

let rootDir: string;
let homeDir: string;
let configDir: string;
let savedConfigDir: string | undefined;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "buddy-slack-actions-home-"));
  configDir = join(homeDir, ".buddy");
  rootDir = mkdtempSync(join(tmpdir(), "buddy-slack-actions-root-"));
  savedConfigDir = process.env.BUDDY_CONFIG_DIR;
  process.env.BUDDY_CONFIG_DIR = configDir;
  writeConnectorConfig("slack", { enabled: true, token: "xoxc", cookie: "xoxd" }, configDir);
});

afterEach(() => {
  if (savedConfigDir === undefined) delete process.env.BUDDY_CONFIG_DIR;
  else process.env.BUDDY_CONFIG_DIR = savedConfigDir;
  rmSync(homeDir, { recursive: true, force: true });
  rmSync(rootDir, { recursive: true, force: true });
});

function mockFetch(handlers: Record<string, () => object>) {
  return async (url: string) => {
    for (const [key, handler] of Object.entries(handlers)) {
      if (url.includes(key)) {
        return new Response(JSON.stringify({ ok: true, ...handler() }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("slack actions (FR-SLACK-01..03)", () => {
  it("help lists read actions", async () => {
    const result = await executeSlackAction(rootDir, "help");
    expect(result.data).toContain("thread");
    expect(slackHelpText()).toContain("force");
  });

  it("thread writes markdown cache and returns path summary", async () => {
    const fetchImpl = mockFetch({
      "conversations.replies": () => ({
        messages: [{ ts: "1712345678.901234", user: "U1", text: "Hello team" }],
      }),
      "conversations.info": () => ({ channel: { id: "C123", name: "general" } }),
      "users.info": () => ({ user: { id: "U1", profile: { display_name: "Alice" } } }),
    });
    const result = await executeSlackAction(
      rootDir,
      "thread",
      { url: "https://team.slack.com/archives/C123/p1712345678901234" },
      { fetchImpl },
    );
    expect(result.data).toContain(".buddy/connections/slack/threads/");
    expect(result.stale).toBe(false);
    const cachePath = join(rootDir, ".buddy/connections/slack/threads/C123-1712345678901234.md");
    expect(existsSync(cachePath)).toBe(true);
    expect(readFileSync(cachePath, "utf8")).toContain("Alice");
  });

  it("channels caches directory in entity store", async () => {
    const fetchImpl = mockFetch({
      "conversations.list": () => ({
        channels: [{ id: "C999", name: "general", num_members: 5 }],
      }),
    });
    const result = await executeSlackAction(rootDir, "channels", {}, { fetchImpl });
    expect(result.data).toContain("general");
    expect(result.data).toContain("C999");
  });

  it("thread auto-registers channel in entity store", async () => {
    const fetchImpl = mockFetch({
      "conversations.replies": () => ({
        messages: [{ ts: "1712345678.901234", user: "U1", text: "Hello" }],
      }),
      "conversations.info": () => ({ channel: { id: "C123", name: "general" } }),
      "users.info": () => ({ user: { id: "U1", profile: { display_name: "Alice" } } }),
    });
    await executeSlackAction(
      rootDir,
      "thread",
      { url: "https://team.slack.com/archives/C123/p1712345678901234" },
      { fetchImpl },
    );
    const store = readEntityStore(rootDir, "slack");
    expect(store.C123).toBeDefined();
    expect(store.C123.name).toBe("general");
    expect(store.C123.source).toBe("slack");
  });

  it("channel_history auto-registers channel in entity store", async () => {
    const fetchImpl = mockFetch({
      "conversations.history": () => ({
        messages: [{ ts: "1712345600.000000", user: "U1", text: "Notes" }],
      }),
      "conversations.info": () => ({ channel: { id: "C456", name: "team-channel" } }),
      "users.info": () => ({ user: { id: "U1", profile: { display_name: "Bob" } } }),
    });
    await executeSlackAction(rootDir, "channel_history", { channel: "C456" }, { fetchImpl });
    const store = readEntityStore(rootDir, "slack");
    expect(store.C456).toBeDefined();
    expect(store.C456.name).toBe("team-channel");
  });

  it("registerChannelFromUse saves dm_peer_name for IM channels", async () => {
    const fetchImpl = mockFetch({
      "conversations.replies": () => ({
        messages: [{ ts: "1712345678.901234", user: "U111", text: "Hi" }],
      }),
      "conversations.info": () => ({
        channel: { id: "D123", name: "D123", is_im: true, user: "U111" },
      }),
      "users.info": () => ({
        user: { id: "U111", profile: { display_name: "Avihai Efrat" } },
      }),
    });
    await executeSlackAction(
      rootDir,
      "thread",
      { url: "https://team.slack.com/archives/D123/p1712345678901234" },
      { fetchImpl },
    );
    const store = readEntityStore(rootDir, "slack");
    expect(store.D123).toBeDefined();
    expect(store.D123.is_im).toBe(true);
    expect((store.D123 as Record<string, unknown>).dm_peer_name).toBe("Avihai Efrat");
  });

  it("auto-register is best-effort: does not fail if conversations.info throws", async () => {
    let infoCallCount = 0;
    const fetchImpl = async (url: string) => {
      if (url.includes("conversations.replies")) {
        return new Response(
          JSON.stringify({
            ok: true,
            messages: [{ ts: "1712345678.901234", user: "U1", text: "Hello" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("conversations.info")) {
        infoCallCount++;
        return new Response(
          JSON.stringify({ ok: false, error: "channel_not_found" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("users.info")) {
        return new Response(
          JSON.stringify({
            ok: true,
            user: { id: "U1", profile: { display_name: "Alice" } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await executeSlackAction(
      rootDir,
      "thread",
      { url: "https://team.slack.com/archives/C999/p1712345678901234" },
      { fetchImpl },
    );
    expect(result.data).toContain("Thread saved");
    expect(infoCallCount).toBeGreaterThan(0);
  });

  it("resolves mentions into user directory", async () => {
    const fetchImpl = mockFetch({
      "conversations.replies": () => ({
        messages: [{ ts: "1712345678.901234", user: "U1", text: "Hi <@U2>" }],
      }),
      "conversations.info": () => ({ channel: { id: "C123", name: "general" } }),
      "users.info": () => ({
        user: { id: "U2", profile: { display_name: "Bob Builder" } },
      }),
    });
    await executeSlackAction(
      rootDir,
      "thread",
      { url: "https://team.slack.com/archives/C123/p1712345678901234" },
      { fetchImpl },
    );
    const cache = readSlackUserCache(rootDir);
    expect(cache.U2?.displayName).toBe("Bob Builder");
  });
});
