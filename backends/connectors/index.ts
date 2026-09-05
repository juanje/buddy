// backends/connectors/index.ts — Conditional connector tool registration (FR-CONN-04).

import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { classifyConnectorAction } from "./actions";
import { listConfiguredDomains } from "./credentials";

/**
 * Minimal stub dispatcher per configured domain — proves registration flow
 * before Sprint 1 ships full Jira/Slack implementations.
 */
function buildStubConnectorTool(domain: string): ToolDefinition {
  return defineTool({
    name: domain,
    label: domain,
    description: `Interact with ${domain}. Call with action='help' to see available actions.`,
    parameters: Type.Object({
      action: Type.String({ description: "Action to perform. Use 'help' for discovery." }),
      params: Type.Optional(Type.Object({}, { additionalProperties: true })),
    }),
    async execute(_callId, args) {
      const action = args.action;
      const decision = classifyConnectorAction(domain, action);
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
      if (action === "help") {
        return {
          content: [{ type: "text", text: `${domain} connector registered (stub — Sprint 1+).` }],
          details: {},
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `${domain} action '${action}' accepted (${decision}); dispatcher not yet implemented.`,
          },
        ],
        details: {},
      };
    },
  });
}

/** Register one Pi tool per configured integration domain (§8.3). */
export function buildConnectorToolset(_rootDir: string): ToolDefinition[] {
  return listConfiguredDomains().map((domain) => buildStubConnectorTool(domain));
}
