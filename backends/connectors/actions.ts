// backends/connectors/actions.ts — Connector action classification (FR-CONN-03/04).

import type { ActionTable } from "../../shared/connector-types";

export type ConnectorActionDecision = "read" | "write" | "deny";

/** Declarative read/write tables per domain (§4.2). Populated as connectors ship. */
export const CONNECTOR_ACTIONS: Record<string, ActionTable> = {
  jira: {
    help: "read",
    board: "read",
    my_issues: "read",
    issue_detail: "read",
    issues_by_key: "read",
    epic_children: "read",
    recent_changes: "read",
    period_report: "read",
    add_comment: "write",
    transition_issue: "write",
  },
  slack: {
    help: "read",
    channels: "read",
    mentions: "read",
    channel_history: "read",
    thread: "read",
    search: "read",
    post_message: "write",
  },
};

export const CONNECTOR_TOOL_NAMES = Object.keys(CONNECTOR_ACTIONS);

export function isConnectorTool(toolName: string): boolean {
  return CONNECTOR_TOOL_NAMES.includes(toolName);
}

export function classifyConnectorAction(domain: string, action: string): ConnectorActionDecision {
  const table = CONNECTOR_ACTIONS[domain];
  if (!table) return "deny";
  const classification = table[action];
  if (!classification) return "deny";
  return classification;
}
