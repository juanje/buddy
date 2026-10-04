// backends/action-tool.ts — shared shape of the `action` + `params` dispatcher tools.
//
// The tasks, Jira and Slack tools all expose one Pi tool taking an action name
// and a free-form params object, refuse unknown actions before dispatching, and
// render the result as a single text block. Only the names and the three
// callbacks differ.

import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

export interface ActionToolSpec<P> {
  name: string;
  label: string;
  description: string;
  /** True when the action must be refused without dispatching. */
  isDenied: (action: string) => boolean;
  /** Run the action and render its result as the tool's text output. */
  run: (action: string, params: P) => string | Promise<string>;
}

export function buildActionTool<P>(spec: ActionToolSpec<P>): ToolDefinition {
  return defineTool({
    name: spec.name,
    label: spec.label,
    description: spec.description,
    parameters: Type.Object({
      action: Type.String({ description: "Action to perform. Use 'help' for discovery." }),
      params: Type.Optional(Type.Object({}, { additionalProperties: true })),
    }),
    async execute(_callId, args) {
      const action = args.action;
      if (spec.isDenied(action)) {
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

      const params = (args.params ?? {}) as P;
      const text = await spec.run(action, params);
      return {
        content: [{ type: "text", text }],
        details: {},
      };
    },
  });
}
