// tests/steps/connectors.steps.ts — FR-CONN-01..04 service connector infrastructure.

import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildAgentToolset } from "../../backends/session-boot";
import { writeConnectorConfig, connectorConfigPath } from "../../backends/connectors/credentials";
import {
  ConnectorCacheError,
  isCacheStale,
  writeCacheFileForTest,
} from "../../backends/connectors/cache";
import { evaluateToolCall } from "../../backends/permissions";
import type { BuddyWorld } from "../support/world";

interface ConnectorsWorld extends BuddyWorld {
  rootDir?: string;
  homeDir?: string;
  configDir?: string;
  cacheMeta?: { synced_at: string; stale_after: string };
  force?: boolean;
  cacheFresh?: boolean;
  permissionDecision?: ReturnType<typeof evaluateToolCall>;
  toolsetNames?: string[];
}

function setupHomeConfig(this: ConnectorsWorld): { home: string; configDir: string } {
  if (!this.homeDir || !this.configDir) {
    this.homeDir = mkdtempSync(join(tmpdir(), "buddy-home-"));
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

function ensureRoot(this: ConnectorsWorld): string {
  if (!this.rootDir) {
    setupHomeConfig.call(this);
    this.rootDir = mkdtempSync(join(tmpdir(), "buddy-connectors-"));
  }
  return this.rootDir;
}

Given("a jira integration credential file exists", function (this: ConnectorsWorld) {
  const { home, configDir } = setupHomeConfig.call(this);
  writeConnectorConfig("jira", { enabled: true, baseUrl: "https://jira.example.com", token: "secret" }, configDir);
  this.homeDir = home;
  this.configDir = configDir;
});

When("the agent attempts to read the jira credential file", function (this: ConnectorsWorld) {
  const { home, configDir } = setupHomeConfig.call(this);
  const path = connectorConfigPath("jira", configDir);
  this.permissionDecision = evaluateToolCall(
    "read",
    { path },
    ensureRoot.call(this),
    home,
    configDir,
  );
});

Then("the read is denied", function (this: ConnectorsWorld) {
  assert.equal(this.permissionDecision?.action, "deny");
});

Given(
  "a connector cache entry synced {int} minutes ago with stale_after {word}",
  function (this: ConnectorsWorld, minutesAgo: number, staleAfter: string) {
    const syncedAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
    this.cacheMeta = { synced_at: syncedAt, stale_after: staleAfter };
  },
);

When("staleness is checked without force", function (this: ConnectorsWorld) {
  assert.ok(this.cacheMeta);
  this.force = false;
  this.cacheFresh = !isCacheStale(this.cacheMeta, this.force);
});

When("staleness is checked with force", function (this: ConnectorsWorld) {
  assert.ok(this.cacheMeta);
  this.force = true;
  this.cacheFresh = !isCacheStale(this.cacheMeta, this.force);
});

Then("the cache entry is fresh", function (this: ConnectorsWorld) {
  assert.equal(this.cacheFresh, true);
});

Then("the cache entry is stale", function (this: ConnectorsWorld) {
  assert.equal(this.cacheFresh, false);
});

Given("a buddy workspace", function (this: ConnectorsWorld) {
  ensureRoot.call(this);
});

When("a connector cache write targets {string}", function (this: ConnectorsWorld, relPath: string) {
  const root = ensureRoot.call(this);
  try {
    writeCacheFileForTest(root, relPath, { test: true });
    this.cacheFresh = true;
  } catch (error) {
    if (error instanceof ConnectorCacheError) {
      this.cacheFresh = false;
      return;
    }
    throw error;
  }
});

Then("the cache write is refused", function (this: ConnectorsWorld) {
  assert.equal(this.cacheFresh, false);
});

When('a jira connector call uses action {string}', function (this: ConnectorsWorld, action: string) {
  const { home, configDir } = setupHomeConfig.call(this);
  this.permissionDecision = evaluateToolCall(
    "jira",
    { action, params: {} },
    ensureRoot.call(this),
    home,
    configDir,
  );
});

Then("the permission gate denies the call", function (this: ConnectorsWorld) {
  assert.equal(this.permissionDecision?.action, "deny");
});

Then("the permission gate asks for confirmation", function (this: ConnectorsWorld) {
  assert.equal(this.permissionDecision?.action, "ask");
  if (this.permissionDecision?.action === "ask") {
    assert.equal(this.permissionDecision.op, "write");
  }
});

Given("no connector integrations are configured", function (this: ConnectorsWorld) {
  setupHomeConfig.call(this);
  ensureRoot.call(this);
});

Given("a jira integration is configured", function (this: ConnectorsWorld) {
  const { configDir } = setupHomeConfig.call(this);
  writeConnectorConfig("jira", { enabled: true, baseUrl: "https://jira.example.com" }, configDir);
  ensureRoot.call(this);
});

When("the agent toolset is built", function (this: ConnectorsWorld) {
  const root = ensureRoot.call(this);
  this.toolsetNames = buildAgentToolset(root, {
    requestPermission: async () => true,
    showFile: () => {},
  }).names;
});

Then("the jira tool is not offered", function (this: ConnectorsWorld) {
  assert.ok(this.toolsetNames);
  assert.ok(!this.toolsetNames.includes("jira"));
});

Then("the jira tool is offered", function (this: ConnectorsWorld) {
  assert.ok(this.toolsetNames);
  assert.ok(this.toolsetNames.includes("jira"));
});
