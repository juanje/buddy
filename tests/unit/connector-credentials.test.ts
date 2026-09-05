// tests/unit/connector-credentials.test.ts — FR-CONN-01 credential storage.

import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  connectorConfigPath,
  listConfiguredDomains,
  readConnectorConfig,
  writeConnectorConfig,
} from "../../backends/connectors/credentials";
import { isDenylistedPath } from "../../backends/permissions";
import { STATE_FILE_MODE } from "../../shared/defaults";

let home: string;
let configDir: string;
let savedConfigDir: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "buddy-conn-cred-home-"));
  configDir = join(home, ".buddy");
  savedConfigDir = process.env.BUDDY_CONFIG_DIR;
  process.env.BUDDY_CONFIG_DIR = configDir;
});

afterEach(() => {
  if (savedConfigDir === undefined) delete process.env.BUDDY_CONFIG_DIR;
  else process.env.BUDDY_CONFIG_DIR = savedConfigDir;
  rmSync(home, { recursive: true, force: true });
});

describe("connector credentials (FR-CONN-01)", () => {
  it("round-trips config through read and write", () => {
    writeConnectorConfig("jira", { baseUrl: "https://jira.example.com", token: "abc" }, configDir);
    expect(readConnectorConfig("jira", configDir)).toEqual({
      baseUrl: "https://jira.example.com",
      token: "abc",
    });
  });

  it("writes integration files with mode 0600", () => {
    writeConnectorConfig("jira", { token: "secret" }, configDir);
    const mode = statSync(connectorConfigPath("jira", configDir)).mode & 0o777;
    expect(mode).toBe(STATE_FILE_MODE);
  });

  it("lists configured domains from integrations directory", () => {
    writeConnectorConfig("jira", { token: "a" }, configDir);
    writeConnectorConfig("slack", { token: "b" }, configDir);
    expect(listConfiguredDomains(configDir)).toEqual(["jira", "slack"]);
  });

  it("denylists integration credential paths from agent reads", () => {
    writeConnectorConfig("jira", { token: "secret" }, configDir);
    const path = connectorConfigPath("jira", configDir);
    expect(existsSync(path)).toBe(true);
    expect(isDenylistedPath(path, home)).toBe(true);
  });
});
