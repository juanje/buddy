// backends/dashboard/validate-content.ts — Dashboard validation for dashboard() (FR-DASH-12).

import { toIsoDay } from "../../shared/dates";
import { parseDashboardDocument, parseDashboardParts } from "../../shared/dashboard/parse";
import { validateWidgetSpec } from "../../shared/dashboard/schema";
import { parseDashboardYamlBlock } from "../../shared/dashboard/yaml-blocks";
import { resolveDashboardContent } from "./resolve";

export type DashboardValidationIssue = {
  part: number;
  widget?: number;
  message: string;
};

export function collectDashboardValidationIssues(
  rootDir: string,
  content: string,
  today?: string,
): DashboardValidationIssue[] {
  const todayStr = today ?? toIsoDay(new Date());
  const { body } = parseDashboardDocument(content);
  const parts = parseDashboardParts(body);
  const issues: DashboardValidationIssue[] = [];

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    if (part.kind === "text") continue;
    if (part.fenceError) {
      issues.push({ part: partIndex, message: part.fenceError });
      continue;
    }
    const parsed = parseDashboardYamlBlock(part.yaml);
    if (!parsed.ok) {
      issues.push({ part: partIndex, message: parsed.message });
      continue;
    }
    for (let widgetIndex = 0; widgetIndex < parsed.items.length; widgetIndex += 1) {
      const validated = validateWidgetSpec(parsed.items[widgetIndex]!);
      if (validated.error) {
        issues.push({ part: partIndex, widget: widgetIndex, message: validated.error });
      }
    }
  }

  const resolved = resolveDashboardContent(rootDir, content, todayStr);
  let widgetIndex = 0;
  for (const seg of resolved.segments) {
    if (seg.kind !== "widget") continue;
    if (seg.result.kind === "error") {
      issues.push({ part: 0, widget: widgetIndex, message: seg.result.message });
    }
    widgetIndex += 1;
  }

  return issues;
}

export function formatValidationIssues(issues: DashboardValidationIssue[]): string {
  if (issues.length === 0) return "Dashboard is valid.";
  return issues
    .map((issue) => {
      const where =
        issue.widget !== undefined
          ? `block ${issue.part + 1}, widget ${issue.widget + 1}`
          : `block ${issue.part + 1}`;
      return `- ${where}: ${issue.message}`;
    })
    .join("\n");
}
