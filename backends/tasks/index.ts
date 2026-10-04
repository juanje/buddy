// backends/tasks/index.ts — tasks() Pi tool (FR-TASK).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { buildActionTool } from "../action-tool";
import { classifyTaskAction } from "./actions";
import { executeTaskAction, type TaskActionParams } from "./task-actions";
import { taskResultToText } from "./task-result";

export function buildTaskTool(rootDir: string): ToolDefinition {
  return buildActionTool<TaskActionParams>({
    name: "tasks",
    label: "Tasks",
    description:
      "Manage personal tasks in user/tasks.md. Call with action='help' to see available actions.",
    isDenied: (action) => classifyTaskAction(action) === "deny",
    run: (action, params) => taskResultToText(executeTaskAction(rootDir, action, params)),
  });
}
