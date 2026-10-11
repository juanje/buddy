// backends/data/index.ts — data() Pi tool (FR-DATA-02).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { buildActionTool } from "../action-tool";
import {
  classifyDataAction,
  dataResultToText,
  executeDataAction,
  type DataActionParams,
} from "./data-tool-actions";

export function buildDataTool(rootDir: string): ToolDefinition {
  return buildActionTool<DataActionParams>({
    name: "data",
    label: "Data",
    description:
      "Register and list agent-maintained data in user/data/index.md. Arguments go in params. Call with action='help' to see available actions; you do not need to read CSV rows to discover columns.",
    isDenied: (action) => classifyDataAction(action) === "deny",
    run: (action, params) => dataResultToText(executeDataAction(rootDir, action, params)),
  });
}
