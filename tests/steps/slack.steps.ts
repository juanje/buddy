// tests/steps/slack.steps.ts — FR-SLACK-01..03 Slack connector BDD.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeSlackAction } from "../../backends/connectors/slack-actions";
import { connectorResultToText } from "../../backends/connectors/slack-result";
import { readEntityStore, readThreadFile, writeThreadFile } from "../../backends/connectors/cache";
import {
  connectorConfigPath,
  writeConnectorConfig,
} from "../../backends/connectors/credentials";
import { saveSlackConfig, testSlackConnectionFromConfig } from "../../backends/connectors/settings";
import { readSlackUserCache } from "../../backends/connectors/slack-users";
import { channelFileId, threadFileId } from "../../backends/connectors/slack-url-parser";
import type { ConnectorResult } from "../../shared/connector-types";
import type { BuddyWorld } from "../support/world";

interface SlackWorld extends BuddyWorld {
  rootDir?: string;
  homeDir?: string;
  configDir?: string;
  slackResult?: ConnectorResult;
  slackResultText?: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  slackAuthUser?: string;
  slackTestOk?: boolean;
  threadMessages?: Array<{ user: string; text: string }>;
  channelMessages?: Array<{ user: string; text: string }>;
  channelList?: Array<{ id: string; name: string; num_members?: number }>;
  userDirectory?: Record<string, string>;
  userInfoCalled?: boolean;
  conversationsListError?: string;
  channelInfoOverrides?: Record<string, { id: string; name?: string; is_im?: boolean; user?: string }>;
}

function setupHome(this: SlackWorld): { home: string; configDir: string } {
  if (!this.homeDir || !this.configDir) {
    this.homeDir = mkdtempSync(join(tmpdir(), "buddy-slack-home-"));
    this.configDir = join(this.homeDir, ".buddy");
    mkdirSync(this.configDir, { recursive: true });
    const saved = process.env.BUDDY_CONFIG_DIR;
    process.env.BUDDY_CONFIG_DIR = this.configDir;
    this.connect = () => {
      if (saved === undefined) delete process.env.BUDDY_CONFIG_DIR;
      else process.env.BUDDY_CONFIG_DIR = saved;
    };
  }
  return { home: this.homeDir, configDir: this.configDir };
}

function ensureRoot(this: SlackWorld): string {
  if (!this.rootDir) {
    setupHome.call(this);
    this.rootDir = mkdtempSync(join(tmpdir(), "buddy-slack-root-"));
  }
  return this.rootDir;
}

function defaultFetch(this: SlackWorld) {
  return async (url: string, init?: RequestInit) => {
    const body = init?.body ? String(init.body) : "";
    if (url.includes("auth.test")) {
      return new Response(
        JSON.stringify({ ok: true, user: this.slackAuthUser ?? "tester", team: "Team" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("conversations.replies")) {
      const messages =
        this.threadMessages?.map((m, i) => ({
          ts: i === 0 ? "1712345678.901234" : `1712345679.${String(i).padStart(6, "0")}`,
          user: m.user,
          text: m.text,
        })) ?? [];
      return new Response(JSON.stringify({ ok: true, messages }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("conversations.history")) {
      const messages =
        this.channelMessages?.map((m, i) => ({
          ts: `1712345600.${String(i).padStart(6, "0")}`,
          user: m.user,
          text: m.text,
        })) ?? [];
      return new Response(JSON.stringify({ ok: true, messages }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("conversations.list")) {
      if (this.conversationsListError) {
        return new Response(
          JSON.stringify({ ok: false, error: this.conversationsListError }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      const channels =
        this.channelList?.map((c) => ({
          id: c.id,
          name: c.name,
          num_members: c.num_members ?? 3,
        })) ?? [];
      return new Response(JSON.stringify({ ok: true, channels }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("conversations.info")) {
      const channelMatch = /channel=([^&]+)/.exec(body) ?? /channel=([^&]+)/.exec(url);
      const channelId = channelMatch ? decodeURIComponent(channelMatch[1]) : "C123";
      const override = this.channelInfoOverrides?.[channelId];
      const channelData = override ?? { id: channelId, name: "general" };
      return new Response(
        JSON.stringify({ ok: true, channel: channelData }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("users.info")) {
      this.userInfoCalled = true;
      const userMatch = /user=([^&]+)/.exec(body);
      const userId = userMatch ? decodeURIComponent(userMatch[1]) : "U111";
      const name = this.userDirectory?.[userId] ?? userId;
      return new Response(
        JSON.stringify({
          ok: true,
          user: { id: userId, profile: { display_name: name, real_name: name } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: false, error: "unknown_method" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

Given("a configured slack integration", function (this: SlackWorld) {
  const { configDir } = setupHome.call(this);
  ensureRoot.call(this);
  writeConnectorConfig(
    "slack",
    { enabled: true, token: "xoxc-secret", cookie: "xoxd-secret" },
    configDir,
  );
  this.fetchImpl = defaultFetch.call(this);
  this.userDirectory = this.userDirectory ?? {};
});

When(
  'slack config is saved with token {string} and cookie {string}',
  function (this: SlackWorld, token: string, cookie: string) {
    saveSlackConfig({ enabled: true, token, cookie });
  },
);

Given('slack auth test succeeds for user {string}', function (this: SlackWorld, user: string) {
  this.slackAuthUser = user;
  this.fetchImpl = defaultFetch.call(this);
});

When("the slack connection is tested", async function (this: SlackWorld) {
  const result = await testSlackConnectionFromConfig(
    { enabled: true, token: "xoxc-test", cookie: "xoxd-test" },
    { fetchImpl: this.fetchImpl ?? defaultFetch.call(this) },
  );
  this.slackTestOk = result.ok;
});

Then("the slack test result is ok", function (this: SlackWorld) {
  assert.equal(this.slackTestOk, true);
});

When('the slack connector runs action {string}', async function (this: SlackWorld, action: string) {
  const root = ensureRoot.call(this);
  this.slackResult = await executeSlackAction(root, action, {}, { fetchImpl: this.fetchImpl });
  this.slackResultText = connectorResultToText(this.slackResult);
});

When(
  'the slack connector runs action {string} for url {string}',
  async function (this: SlackWorld, action: string, url: string) {
    const root = ensureRoot.call(this);
    this.slackResult = await executeSlackAction(
      root,
      action,
      { url },
      { fetchImpl: this.fetchImpl },
    );
    this.slackResultText = connectorResultToText(this.slackResult);
  },
);

When(
  'the slack connector runs action {string} for url {string} with force',
  async function (this: SlackWorld, action: string, url: string) {
    const root = ensureRoot.call(this);
    this.slackResult = await executeSlackAction(
      root,
      action,
      { url, force: true },
      { fetchImpl: this.fetchImpl },
    );
    this.slackResultText = connectorResultToText(this.slackResult);
  },
);

When(
  'the slack connector runs action {string} for channel {string}',
  async function (this: SlackWorld, action: string, channel: string) {
    const root = ensureRoot.call(this);
    this.slackResult = await executeSlackAction(
      root,
      action,
      { channel },
      { fetchImpl: this.fetchImpl },
    );
    this.slackResultText = connectorResultToText(this.slackResult);
  },
);

Then("the slack result includes {string}", function (this: SlackWorld, text: string) {
  assert.ok(this.slackResultText?.includes(text), `Expected "${text}" in: ${this.slackResultText}`);
});

Then("the slack result suggests help", function (this: SlackWorld) {
  assert.match(this.slackResultText ?? "", /help/i);
});

Given(
  'slack thread in channel {string} returns message from {string}',
  function (this: SlackWorld, _channel: string, author: string) {
    this.threadMessages = [{ user: "U999", text: `${author} root message` }];
  },
);

Given(
  'slack thread in channel {string} returns {int} messages from {string}',
  function (this: SlackWorld, _channel: string, count: number, author: string) {
    this.threadMessages = Array.from({ length: count }, (_, i) => ({
      user: `U${i}`,
      text: i === 0 ? `${author} root message` : `${author} reply ${i}`,
    }));
  },
);

Given(
  'slack thread in channel {string} returns message mentioning user {string}',
  function (this: SlackWorld, _channel: string, userId: string) {
    this.threadMessages = [{ user: "U000", text: `Ping <@${userId}> please` }];
  },
);

Given(
  'slack channel {string} history returns message {string}',
  function (this: SlackWorld, _channel: string, text: string) {
    this.channelMessages = [{ user: "U555", text }];
  },
);

Given(
  'slack conversations list returns channel {string} with id {string}',
  function (this: SlackWorld, name: string, id: string) {
    this.channelList = [{ id, name, num_members: 12 }];
  },
);

Given('slack user {string} resolves to {string}', function (this: SlackWorld, userId: string, name: string) {
  this.userDirectory = { ...(this.userDirectory ?? {}), [userId]: name };
});

Given('a fresh slack thread cache exists for channel {string}', function (this: SlackWorld, channelId: string) {
  const root = ensureRoot.call(this);
  const threadTs = "1712345678.901234";
  const fileId = threadFileId(channelId, threadTs);
  writeThreadFile(
    root,
    "slack",
    fileId,
    { synced_at: new Date().toISOString(), stale_after: "1h", source: "slack" },
    "# Cached thread\n\n## Old User (10:00)\n\nOld cached body",
  );
});

Then('a slack thread cache file exists for channel {string}', function (this: SlackWorld, channelId: string) {
  const root = ensureRoot.call(this);
  const fileId = threadFileId(channelId, "1712345678.901234");
  const cached = readThreadFile(root, "slack", fileId);
  assert.ok(cached, "Expected thread cache file");
});

Then("the slack thread cache file contains {string}", function (this: SlackWorld, text: string) {
  const root = ensureRoot.call(this);
  const fileId = threadFileId("C123", "1712345678.901234");
  const cached = readThreadFile(root, "slack", fileId);
  assert.ok(cached?.body.includes(text), `Expected "${text}" in cache body: ${cached?.body}`);
});

Then(
  'the slack channel cache file for {string} contains {string}',
  function (this: SlackWorld, channelId: string, text: string) {
    const root = ensureRoot.call(this);
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const dateLabel = start.toISOString().slice(0, 10);
    const fileId = channelFileId(channelId, dateLabel);
    const cached = readThreadFile(root, "slack", fileId);
    assert.ok(cached?.body.includes(text), `Expected "${text}" in cache body: ${cached?.body}`);
  },
);

Then('the slack user directory contains {string}', function (this: SlackWorld, name: string) {
  const root = ensureRoot.call(this);
  const cache = readSlackUserCache(root);
  const found = Object.values(cache).some((e) => e.displayName === name);
  assert.ok(found, `Expected user "${name}" in directory`);
});

Then('the slack channel directory contains {string}', function (this: SlackWorld, name: string) {
  const root = ensureRoot.call(this);
  const store = readEntityStore(root, "slack");
  const found = Object.values(store).some((e) => e.name === name || e.id === name);
  assert.ok(found, `Expected channel "${name}" in entity store`);
});

Given("slack conversations list returns enterprise_is_restricted error", function (this: SlackWorld) {
  this.conversationsListError = "enterprise_is_restricted";
});

Given(
  'slack channel {string} is a DM with user {string}',
  function (this: SlackWorld, channelId: string, userId: string) {
    this.channelInfoOverrides = {
      ...(this.channelInfoOverrides ?? {}),
      [channelId]: { id: channelId, is_im: true, user: userId },
    };
  },
);

Then(
  'the slack entity {string} has dm_peer_name {string}',
  function (this: SlackWorld, entityId: string, expectedName: string) {
    const root = ensureRoot.call(this);
    const store = readEntityStore(root, "slack");
    const entity = store[entityId];
    assert.ok(entity, `Expected entity "${entityId}" in store`);
    assert.equal(
      (entity as Record<string, unknown>).dm_peer_name,
      expectedName,
      `Expected dm_peer_name "${expectedName}" on entity "${entityId}"`,
    );
  },
);

Then("saving slack config persists to credential file", function (this: SlackWorld) {
  const { configDir } = setupHome.call(this);
  assert.ok(existsSync(connectorConfigPath("slack", configDir)));
});
