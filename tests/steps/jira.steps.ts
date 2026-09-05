// tests/steps/jira.steps.ts — FR-JIRA-01..05 Jira connector BDD.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeJiraAction } from "../../backends/connectors/jira-actions";
import { connectorResultToText } from "../../backends/connectors/jira-result";
import { writeEntityStore, writeQueryStore } from "../../backends/connectors/cache";
import {
  connectorConfigPath,
  writeConnectorConfig,
} from "../../backends/connectors/credentials";
import { saveJiraConfig } from "../../backends/connectors/settings";
import type { ConnectorResult } from "../../shared/connector-types";
import type { BuddyWorld } from "../support/world";

interface JiraWorld extends BuddyWorld {
  rootDir?: string;
  homeDir?: string;
  configDir?: string;
  jiraResult?: ConnectorResult;
  jiraResultText?: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  searchIssues?: Array<{ key: string; summary: string }>;
  issueDescriptions?: Record<string, string>;
  networkDown?: boolean;
}

function setupHome(this: JiraWorld): { home: string; configDir: string } {
  if (!this.homeDir || !this.configDir) {
    this.homeDir = mkdtempSync(join(tmpdir(), "buddy-jira-home-"));
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

function ensureRoot(this: JiraWorld): string {
  if (!this.rootDir) {
    setupHome.call(this);
    this.rootDir = mkdtempSync(join(tmpdir(), "buddy-jira-root-"));
  }
  return this.rootDir;
}

function defaultFetch(this: JiraWorld) {
  return async (url: string) => {
    if (this.networkDown) {
      throw new TypeError("fetch failed");
    }
    if (url.includes("/myself")) {
      return new Response(JSON.stringify({ accountId: "1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/search/jql")) {
      const issues = (this.searchIssues ?? []).map((item) => ({
        key: item.key,
        fields: {
          summary: item.summary,
          status: { name: "Open" },
          assignee: { displayName: "Alice" },
          priority: { name: "Medium" },
          updated: new Date().toISOString(),
        },
      }));
      return new Response(JSON.stringify({ issues }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/comment")) {
      return new Response(JSON.stringify({ comments: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const keyMatch = /\/issue\/([^/?]+)/.exec(url);
    if (keyMatch) {
      const key = decodeURIComponent(keyMatch[1]).toUpperCase();
      const description = this.issueDescriptions?.[key] ?? "Default description";
      return new Response(
        JSON.stringify({
          key,
          fields: {
            summary: "Issue",
            status: { name: "Open" },
            assignee: { displayName: "Alice" },
            priority: { name: "Medium" },
            updated: new Date().toISOString(),
            description: {
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
            },
            issuelinks: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };
}

Given("a configured jira integration", function (this: JiraWorld) {
  const { configDir } = setupHome.call(this);
  ensureRoot.call(this);
  writeConnectorConfig(
    "jira",
    {
      enabled: true,
      baseUrl: "https://jira.example.com",
      email: "user@example.com",
      token: "secret",
    },
    configDir,
  );
  this.fetchImpl = defaultFetch.call(this);
  this.networkDown = false;
});

Given('jira search returns issue {string} titled {string}', function (this: JiraWorld, key: string, summary: string) {
  this.searchIssues = [{ key, summary }];
});

Given("a fresh jira board cache exists", function (this: JiraWorld) {
  const root = ensureRoot.call(this);
  const syncedAt = new Date().toISOString();
  writeEntityStore(root, "jira", {
    "PROJ-OLD": {
      synced_at: syncedAt,
      stale_after: "15m",
      key: "PROJ-OLD",
      summary: "Cached old",
      status: "Open",
      assignee: "Bob",
    },
  });
  writeQueryStore(root, "jira", "board", {
    keys: ["PROJ-OLD"],
    synced_at: syncedAt,
    stale_after: "15m",
  });
});

Given('jira issue {string} has description {string}', function (this: JiraWorld, key: string, description: string) {
  this.issueDescriptions = { ...(this.issueDescriptions ?? {}), [key.toUpperCase()]: description };
});

Given('a stale jira board cache exists for {string}', function (this: JiraWorld, key: string) {
  const root = ensureRoot.call(this);
  const syncedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  writeEntityStore(root, "jira", {
    [key]: {
      synced_at: syncedAt,
      stale_after: "15m",
      key,
      summary: "Stale cached",
      status: "Open",
      assignee: "Bob",
    },
  });
  writeQueryStore(root, "jira", "board", {
    keys: [key],
    synced_at: syncedAt,
    stale_after: "15m",
  });
});

Given("jira network is unavailable", function (this: JiraWorld) {
  this.networkDown = true;
});

When('the jira connector runs action {string}', async function (this: JiraWorld, action: string) {
  const root = ensureRoot.call(this);
  this.jiraResult = await executeJiraAction(root, action, {}, { fetchImpl: this.fetchImpl ?? defaultFetch.call(this) });
  this.jiraResultText = connectorResultToText(this.jiraResult);
});

When('the jira connector runs action {string} with force', async function (this: JiraWorld, action: string) {
  const root = ensureRoot.call(this);
  this.jiraResult = await executeJiraAction(
    root,
    action,
    { force: true },
    { fetchImpl: this.fetchImpl ?? defaultFetch.call(this) },
  );
  this.jiraResultText = connectorResultToText(this.jiraResult);
});

When('the jira connector runs action {string} for key {string}', async function (this: JiraWorld, action: string, key: string) {
  const root = ensureRoot.call(this);
  this.jiraResult = await executeJiraAction(
    root,
    action,
    { key },
    { fetchImpl: this.fetchImpl ?? defaultFetch.call(this) },
  );
  this.jiraResultText = connectorResultToText(this.jiraResult);
});

Then('the jira result includes {string}', function (this: JiraWorld, text: string) {
  assert.ok(this.jiraResultText?.includes(text), `Expected "${text}" in: ${this.jiraResultText}`);
});

Then("the jira result suggests help", function (this: JiraWorld) {
  assert.ok(this.jiraResult?.error?.suggestion?.includes("help"));
});

Then("the jira result is stale", function (this: JiraWorld) {
  assert.equal(this.jiraResult?.stale, true);
});

Given("a buddy integrations directory", function (this: JiraWorld) {
  setupHome.call(this);
});

When('jira config is saved with base URL {string}', function (this: JiraWorld, baseUrl: string) {
  const { configDir } = setupHome.call(this);
  saveJiraConfig({
    enabled: true,
    baseUrl,
    email: "user@example.com",
    token: "secret",
  });
  this.configDir = configDir;
});

Then('the jira credential file contains that base URL', function (this: JiraWorld) {
  const { configDir } = setupHome.call(this);
  const path = connectorConfigPath("jira", configDir);
  assert.ok(existsSync(path));
  const raw = readFileSync(path, "utf8");
  assert.match(raw, /jira\.example\.com/);
});
