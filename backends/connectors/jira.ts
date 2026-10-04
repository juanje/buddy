// backends/connectors/jira.ts — Jira dispatcher tool (FR-JIRA-01..03).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { buildActionTool } from "../action-tool";
import { classifyConnectorAction } from "./actions";
import { executeJiraAction, type JiraActionParams } from "./jira-actions";
import { connectorResultToText } from "./jira-result";

export function buildJiraConnectorTool(rootDir: string): ToolDefinition {
  return buildActionTool<JiraActionParams>({
    name: "jira",
    label: "Jira",
    description:
      "Interact with Jira. Call with action='help' to see available actions and parameters.",
    isDenied: (action) => classifyConnectorAction("jira", action) === "deny",
    run: async (action, params) =>
      connectorResultToText(await executeJiraAction(rootDir, action, params)),
  });
}
