// backends/tasks/index.ts — tasks() Pi tool (FR-TASK).

import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { classifyTaskAction } from "./actions";
import { executeTaskAction, type TaskActionParams } from "./task-actions";
import { taskResultToText } from "./task-result";

export function buildTaskTool(rootDir: string): ToolDefinition {
  return defineTool({
    name: "tasks",
    label: "Tasks",
    description:
      "Manage personal tasks in user/tasks.md. Call with action='help' to see available actions.",
    parameters: Type.Object({
      action: Type.String({ description: "Action to perform. Use 'help' for discovery." }),
      params: Type.Optional(Type.Object({}, { additionalProperties: true })),
    }),
    async execute(_callId, args) {
      const action = args.action;
      const decision = classifyTaskAction(action);
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

      const params = (args.params ?? {}) as TaskActionParams;
      const result = executeTaskAction(rootDir, action, params);
      return {
        content: [{ type: "text", text: taskResultToText(result) }],
        details: {},
      };
    },
  });
}
