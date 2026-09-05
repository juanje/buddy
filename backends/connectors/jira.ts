// backends/connectors/jira.ts — Jira dispatcher tool (FR-JIRA-01..03).

import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { classifyConnectorAction } from "./actions";
import { executeJiraAction, type JiraActionParams } from "./jira-actions";
import { connectorResultToText } from "./jira-result";

export function buildJiraConnectorTool(rootDir: string): ToolDefinition {
  return defineTool({
    name: "jira",
    label: "Jira",
    description:
      "Interact with Jira. Call with action='help' to see available actions and parameters.",
    parameters: Type.Object({
      action: Type.String({ description: "Action to perform. Use 'help' for discovery." }),
      params: Type.Optional(Type.Object({}, { additionalProperties: true })),
    }),
    async execute(_callId, args) {
      const action = args.action;
      const decision = classifyConnectorAction("jira", action);
      if (decision === "deny") {
        return {
          content: [
            {
              type: "text",
              text: `Unknown action '${action}'. Use action='help' to see available actions.`,
            },
          ],
          details: {},
        };
      }

      const params = (args.params ?? {}) as JiraActionParams;
      const result = await executeJiraAction(rootDir, action, params);
      return {
        content: [{ type: "text", text: connectorResultToText(result) }],
        details: {},
      };
    },
  });
}
