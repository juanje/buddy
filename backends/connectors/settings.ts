// backends/connectors/settings.ts — Integration config for Settings UI (FR-JIRA-04, FR-SLACK-01).

import type { ConnectorConfig } from "../../shared/connector-types";
import { readConnectorConfig, writeConnectorConfig } from "./credentials";
import { testJiraConnection, type JiraClientOptions } from "./jira-client";
import { testSlackConnection, type SlackClientOptions } from "./slack-client";

export function loadJiraConfig(): ConnectorConfig | undefined {
  return readConnectorConfig("jira");
}

export function saveJiraConfig(config: ConnectorConfig): void {
  writeConnectorConfig("jira", config);
}

export async function testJiraConnectionFromConfig(
  config: ConnectorConfig,
  options?: JiraClientOptions,
): Promise<{ ok: boolean; error?: string }> {
  return testJiraConnection(config, options);
}

export function loadSlackConfig(): ConnectorConfig | undefined {
  return readConnectorConfig("slack");
}

export function saveSlackConfig(config: ConnectorConfig): void {
  writeConnectorConfig("slack", config);
}

export async function testSlackConnectionFromConfig(
  config: ConnectorConfig,
  options?: SlackClientOptions,
): Promise<{ ok: boolean; error?: string }> {
  return testSlackConnection(config, options);
}
