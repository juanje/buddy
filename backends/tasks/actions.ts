// backends/tasks/actions.ts — tasks() action classification (FR-TASK).

import type { ActionTable } from "../../shared/connector-types";

export const TASK_TOOL_NAME = "tasks";

export const TASK_ACTIONS: ActionTable = {
  help: "read",
  add: "read",
  edit: "read",
  complete: "read",
  set_next: "read",
  list: "read",
  move: "read",
  annotate: "read",
  config: "read",
  remove: "write",
};

export type TaskActionDecision = "read" | "write" | "deny";

export function isTaskTool(toolName: string): boolean {
  return toolName === TASK_TOOL_NAME;
}

export function classifyTaskAction(action: string): TaskActionDecision {
  const classification = TASK_ACTIONS[action];
  if (!classification) return "deny";
  return classification;
}
