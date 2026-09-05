// backends/connectors/jira-result.ts — ConnectorResult → tool/agent text.

import type { ConnectorError, ConnectorResult } from "../../shared/connector-types";

export function connectorErrorMessage(error: ConnectorError): string {
  return `${error.error}. ${error.suggestion}`;
}

export function connectorResultToText(result: ConnectorResult): string {
  if (result.error) {
    return connectorErrorMessage(result.error);
  }
  if (result.stale && result.synced_at) {
    return `[STALE — last synced ${result.synced_at}]\n${result.data}`;
  }
  return result.data;
}

export function connectorResultFromError(error: ConnectorError): ConnectorResult {
  return { data: "", stale: false, error };
}
