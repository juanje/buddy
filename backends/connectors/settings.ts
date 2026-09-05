// backends/connectors/settings.ts — Integration config for Settings UI (FR-JIRA-04).

import type { ConnectorConfig } from "../../shared/connector-types";
import { readConnectorConfig, writeConnectorConfig } from "./credentials";
import { testJiraConnection, type JiraClientOptions } from "./jira-client";

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
