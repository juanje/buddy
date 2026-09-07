// tests/unit/connector-settings.test.ts — FR-JIRA-04 integration settings backend.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadJiraConfig,
  loadSlackConfig,
  saveJiraConfig,
  saveSlackConfig,
  testJiraConnectionFromConfig,
  testSlackConnectionFromConfig,
} from "../../backends/connectors/settings";
import { connectorConfigPath } from "../../backends/connectors/credentials";

let configDir: string;
let savedConfigDir: string | undefined;

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), "buddy-conn-settings-home-"));
  configDir = join(home, ".buddy");
  savedConfigDir = process.env.BUDDY_CONFIG_DIR;
  process.env.BUDDY_CONFIG_DIR = configDir;
});

afterEach(() => {
  if (savedConfigDir === undefined) delete process.env.BUDDY_CONFIG_DIR;
  else process.env.BUDDY_CONFIG_DIR = savedConfigDir;
  rmSync(join(configDir, ".."), { recursive: true, force: true });
});

describe("connector settings (FR-JIRA-04)", () => {
  it("loads and saves jira config", () => {
    saveJiraConfig({
      enabled: true,
      baseUrl: "https://jira.example.com",
      email: "a@b.com",
      token: "tok",
    });
    expect(loadJiraConfig()?.baseUrl).toBe("https://jira.example.com");
    expect(existsSync(connectorConfigPath("jira", configDir))).toBe(true);
  });

  it("testJiraConnection delegates to client", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ accountId: "1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const result = await testJiraConnectionFromConfig(
      { baseUrl: "https://jira.example.com", email: "a@b.com", token: "tok" },
      { fetchImpl },
    );
    expect(result.ok).toBe(true);
  });

  it("persists config as JSON on disk", () => {
    saveJiraConfig({ enabled: true, baseUrl: "https://x.atlassian.net", email: "u", token: "t" });
    const parsed = JSON.parse(readFileSync(connectorConfigPath("jira", configDir), "utf8"));
    expect(parsed.baseUrl).toBe("https://x.atlassian.net");
  });

  it("loads and saves slack config", () => {
    saveSlackConfig({ enabled: true, token: "xoxc", cookie: "xoxd" });
    expect(loadSlackConfig()?.token).toBe("xoxc");
    expect(existsSync(connectorConfigPath("slack", configDir))).toBe(true);
  });

  it("testSlackConnection delegates to client", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ ok: true, user: "u" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const result = await testSlackConnectionFromConfig(
      { token: "xoxc", cookie: "xoxd" },
      { fetchImpl },
    );
    expect(result.ok).toBe(true);
  });
});
