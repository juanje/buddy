// backends/dashboard/index.ts — dashboard() Pi tool (FR-DASH-12).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { buildActionTool } from "../action-tool";
import {
  classifyDashboardAction,
  dashboardResultToText,
  executeDashboardAction,
  type DashboardActionParams,
} from "./dashboard-tool-actions";

export function buildDashboardTool(rootDir: string): ToolDefinition {
  return buildActionTool<DashboardActionParams>({
    name: "dashboard",
    label: "Dashboard",
    description:
      "Create and validate dashboards in user/dashboards/. Call with action='help' to see available actions.",
    isDenied: (action) => classifyDashboardAction(action) === "deny",
    run: (action, params) => dashboardResultToText(executeDashboardAction(rootDir, action, params)),
  });
}
