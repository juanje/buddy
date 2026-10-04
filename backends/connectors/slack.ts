// backends/connectors/slack.ts — Slack dispatcher tool (FR-SLACK-01..03).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { buildActionTool } from "../action-tool";
import { classifyConnectorAction } from "./actions";
import { executeSlackAction, type SlackActionParams } from "./slack-actions";
import { connectorResultToText } from "./slack-result";

export function buildSlackConnectorTool(rootDir: string): ToolDefinition {
  return buildActionTool<SlackActionParams>({
    name: "slack",
    label: "Slack",
    description:
      "Interact with Slack. Call with action='help' to see available actions and parameters.",
    isDenied: (action) => classifyConnectorAction("slack", action) === "deny",
    run: async (action, params) =>
      connectorResultToText(await executeSlackAction(rootDir, action, params)),
  });
}
