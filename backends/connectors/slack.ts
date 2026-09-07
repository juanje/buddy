// backends/connectors/slack.ts — Slack dispatcher tool (FR-SLACK-01..03).

import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { classifyConnectorAction } from "./actions";
import { executeSlackAction, type SlackActionParams } from "./slack-actions";
import { connectorResultToText } from "./slack-result";

export function buildSlackConnectorTool(rootDir: string): ToolDefinition {
  return defineTool({
    name: "slack",
    label: "Slack",
    description:
      "Interact with Slack. Call with action='help' to see available actions and parameters.",
    parameters: Type.Object({
      action: Type.String({ description: "Action to perform. Use 'help' for discovery." }),
      params: Type.Optional(Type.Object({}, { additionalProperties: true })),
    }),
    async execute(_callId, args) {
      const action = args.action;
      const decision = classifyConnectorAction("slack", action);
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

      const params = (args.params ?? {}) as SlackActionParams;
      const result = await executeSlackAction(rootDir, action, params);
      return {
        content: [{ type: "text", text: connectorResultToText(result) }],
        details: {},
      };
    },
  });
}
