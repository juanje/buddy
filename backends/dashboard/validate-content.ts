// backends/dashboard/validate-content.ts — Dashboard validation for dashboard() (FR-DASH-12).

import { toIsoDay } from "../../shared/dates";
import { resolveDashboardContent } from "./resolve";

export type DashboardValidationIssue = {
  block: number;
  widget?: number;
  message: string;
};

export function collectDashboardValidationIssues(
  rootDir: string,
  content: string,
  today?: string,
): DashboardValidationIssue[] {
  const todayStr = today ?? toIsoDay(new Date());
  const resolved = resolveDashboardContent(rootDir, content, todayStr);
  const issues: DashboardValidationIssue[] = [];

  for (const seg of resolved.segments) {
    if (seg.kind !== "widget" || seg.result.kind !== "error") continue;
    const block = seg.position?.block ?? 1;
    issues.push({
      block,
      widget: seg.position?.widget,
      message: seg.result.message,
    });
  }

  return issues;
}

export function formatValidationIssues(issues: DashboardValidationIssue[]): string {
  if (issues.length === 0) return "Dashboard is valid.";
  return issues
    .map((issue) => {
      const where =
        issue.widget !== undefined
          ? `block ${issue.block}, widget ${issue.widget}`
          : `block ${issue.block}`;
      return `- ${where}: ${issue.message}`;
    })
    .join("\n");
}
