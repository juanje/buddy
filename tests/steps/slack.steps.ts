// tests/steps/slack.steps.ts — FR-SLACK-01..03 Slack connector BDD.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeSlackAction } from "../../backends/connectors/slack-actions";
import { connectorResultToText } from "../../backends/connectors/slack-result";
import {
  connectionsDir,
  readEntityStore,
  readThreadFile,
  writeEntityStore,
  writeThreadFile,
} from "../../backends/connectors/cache";
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
  usersList?: Array<{ id: string; name: string }>;
  usersListError?: string;
  userApiCalled?: boolean;
  dmOpens?: Record<string, string>;
  dmOpenError?: string;
  dmOpenCalled?: boolean;
  historyRequestBodies?: string[];
  channelMessagesFor?: string;
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
    if (url.includes("conversations.open")) {
      this.dmOpenCalled = true;
      if (this.dmOpenError) {
        return new Response(JSON.stringify({ ok: false, error: this.dmOpenError }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const usersMatch = /users=([^&]+)/.exec(body);
      const userId = usersMatch ? decodeURIComponent(usersMatch[1]) : "";
      const channelId = this.dmOpens?.[userId];
      return new Response(
        JSON.stringify(
          channelId ? { ok: true, channel: { id: channelId } } : { ok: false, error: "user_not_found" },
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("conversations.history")) {
      this.historyRequestBodies = [...(this.historyRequestBodies ?? []), body];
      const historyChannel = decodeURIComponent(/channel=([^&]+)/.exec(body)?.[1] ?? "");
      const forThisChannel = !this.channelMessagesFor || this.channelMessagesFor === historyChannel;
      const messages = !forThisChannel
        ? []
        : this.channelMessages?.map((m, i) => ({
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
      const openedFor = Object.entries(this.dmOpens ?? {}).find(([, dm]) => dm === channelId)?.[0];
      const channelData =
        override ??
        (openedFor ? { id: channelId, is_im: true, user: openedFor } : { id: channelId, name: "general" });
      return new Response(
        JSON.stringify({ ok: true, channel: channelData }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("users.list")) {
      this.userApiCalled = true;
      if (this.usersListError) {
        return new Response(JSON.stringify({ ok: false, error: this.usersListError }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const members = (this.usersList ?? []).map((u) => ({
        id: u.id,
        name: u.name.toLowerCase().replace(/\s+/g, "."),
        real_name: u.name,
        profile: { display_name: u.name, real_name: u.name },
      }));
      return new Response(JSON.stringify({ ok: true, members }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("users.info")) {
      this.userInfoCalled = true;
      this.userApiCalled = true;
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
  function (this: SlackWorld, channel: string, text: string) {
    this.channelMessages = [{ user: "U555", text }];
    this.channelMessagesFor = channel;
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

Given(
  "the slack user directory already knows {string} as {string}",
  function (this: SlackWorld, userId: string, name: string) {
    const dir = connectionsDir(ensureRoot.call(this), "slack");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "users.json"),
      JSON.stringify({ [userId]: { displayName: name, synced_at: new Date().toISOString() } }),
      "utf8",
    );
  },
);

Given(
  "the slack channel directory has DM {string} with {string} as user {string}",
  function (this: SlackWorld, channelId: string, name: string, userId: string) {
    const root = ensureRoot.call(this);
    writeEntityStore(root, "slack", {
      [channelId]: {
        synced_at: new Date().toISOString(),
        stale_after: "1h",
        source: "slack",
        id: channelId,
        name: channelId,
        is_im: true,
        user: userId,
        dm_peer_name: name,
      },
    });
  },
);

Given(
  "the slack user list includes {string} named {string}",
  function (this: SlackWorld, userId: string, name: string) {
    this.usersList = [...(this.usersList ?? []), { id: userId, name }];
  },
);

Given("the slack user list returns enterprise_is_restricted error", function (this: SlackWorld) {
  this.usersListError = "enterprise_is_restricted";
});

When("the slack connector looks up the user {string}", async function (this: SlackWorld, name: string) {
  const root = ensureRoot.call(this);
  this.slackResult = await executeSlackAction(
    root,
    "find_user",
    { name },
    { fetchImpl: this.fetchImpl },
  );
  this.slackResultText = connectorResultToText(this.slackResult);
});

Then("no slack user API was called", function (this: SlackWorld) {
  assert.equal(this.userApiCalled ?? false, false, "expected the local directory to answer");
});

Given(
  "slack opens the DM with user {string} as {string}",
  function (this: SlackWorld, userId: string, channelId: string) {
    this.dmOpens = { ...(this.dmOpens ?? {}), [userId]: channelId };
  },
);

Given("slack refuses to open DMs with enterprise_is_restricted", function (this: SlackWorld) {
  this.dmOpenError = "enterprise_is_restricted";
});

When(
  "the slack connector reads the last {int} messages of channel {string}",
  async function (this: SlackWorld, last: number, channel: string) {
    const root = ensureRoot.call(this);
    this.slackResult = await executeSlackAction(
      root,
      "channel_history",
      { channel, last },
      { fetchImpl: this.fetchImpl },
    );
    this.slackResultText = connectorResultToText(this.slackResult);
  },
);

Then("the saved slack file contains {string}", function (this: SlackWorld, text: string) {
  const match = /saved to (\S+)/.exec(this.slackResultText ?? "");
  assert.ok(match, `expected a saved file path in: ${this.slackResultText}`);
  const content = readFileSync(join(ensureRoot.call(this), match[1]!), "utf8");
  assert.ok(content.includes(text), `expected "${text}" in ${match[1]}`);
});

Then("slack was not asked to open a DM", function (this: SlackWorld) {
  assert.equal(this.dmOpenCalled ?? false, false, "expected the directory to know the DM");
});

Then("the slack history request had no date bound", function (this: SlackWorld) {
  const bodies = this.historyRequestBodies ?? [];
  assert.ok(bodies.length > 0, "expected a conversations.history request");
  assert.ok(
    bodies.every((b) => !/(^|&)oldest=/.test(b)),
    `expected no oldest bound in: ${bodies.join(" | ")}`,
  );
});
