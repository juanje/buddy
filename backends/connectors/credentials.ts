// backends/connectors/credentials.ts — Connector credential storage (FR-CONN-01).

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { ConnectorConfig } from "../../shared/connector-types";
import { STATE_FILE_MODE } from "../../shared/defaults";
import { globalConfigDir } from "../global-config";
import { readStateFile, writeStateFile } from "../state-file";

export const INTEGRATIONS_DIR_NAME = "integrations";

export function integrationsDir(configDir: string = globalConfigDir()): string {
  return join(configDir, INTEGRATIONS_DIR_NAME);
}

export function connectorConfigPath(
  domain: string,
  configDir: string = globalConfigDir(),
): string {
  return join(integrationsDir(configDir), `${domain}.json`);
}

export function readConnectorConfig(
  domain: string,
  configDir: string = globalConfigDir(),
): ConnectorConfig | undefined {
  return readStateFile<ConnectorConfig>(connectorConfigPath(domain, configDir));
}

export function writeConnectorConfig(
  domain: string,
  config: ConnectorConfig,
  configDir: string = globalConfigDir(),
): void {
  writeStateFile(connectorConfigPath(domain, configDir), config, { mode: STATE_FILE_MODE });
}

/** Domains with a persisted integration config file (basename without .json). */
export function listConfiguredDomains(configDir: string = globalConfigDir()): string[] {
  const dir = integrationsDir(configDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort();
}
