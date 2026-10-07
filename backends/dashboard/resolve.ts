// backends/dashboard/resolve.ts — Resolve dashboard markdown to a view model (FR-DASH-01+).

import { toIsoDay } from "../../shared/dates";
import { parseDashboardDocument, parseDashboardParts } from "../../shared/dashboard/parse";
import { validateWidgetSpec } from "../../shared/dashboard/schema";
import type {
  ResolvedDashboard,
  ResolvedSegment,
  WidgetResult,
  WidgetSpec,
} from "../../shared/dashboard/types";
import { parseDashboardYamlBlock } from "../../shared/dashboard/yaml-blocks";
import { loadSourceRows } from "./sources";

function resolveTextWidget(spec: WidgetSpec): WidgetResult {
  const text = spec.raw.text;
  return { kind: "text", text: typeof text === "string" ? text : "" };
}

function resolveWidgetData(rootDir: string, spec: WidgetSpec, today: string): WidgetResult {
  if (spec.view === "text") {
    return resolveTextWidget(spec);
  }
  const source = spec.source;
  if (!source) {
    return { kind: "error", message: `View '${spec.view}' requires a source` };
  }
  const loaded = loadSourceRows(rootDir, source, today);
  if (!loaded.ok) {
    return { kind: "error", message: loaded.message };
  }
  return { kind: "rows", rows: loaded.rows };
}

function widgetSegment(spec: WidgetSpec, result: WidgetResult): ResolvedSegment {
  return { kind: "widget", spec, result };
}

function errorWidget(message: string): ResolvedSegment {
  const spec: WidgetSpec = { view: "text", width: "full", raw: {} };
  return widgetSegment(spec, { kind: "error", message });
}

export function resolveDashboardContent(
  rootDir: string,
  content: string,
  today?: string,
): ResolvedDashboard {
  const todayStr = today ?? toIsoDay(new Date());
  const { title, summary, body } = parseDashboardDocument(content);
  const parts = parseDashboardParts(body);
  const segments: ResolvedSegment[] = [];

  for (const part of parts) {
    if (part.kind === "text") {
      segments.push({ kind: "text", markdown: part.markdown });
      continue;
    }
    if (part.fenceError) {
      segments.push(errorWidget(part.fenceError));
      continue;
    }
    const parsed = parseDashboardYamlBlock(part.yaml);
    if (!parsed.ok) {
      segments.push(errorWidget(parsed.message));
      continue;
    }
    for (const item of parsed.items) {
      const validated = validateWidgetSpec(item);
      if (validated.error || !validated.spec) {
        const fallback: WidgetSpec = {
          view: typeof item.view === "string" ? item.view : "text",
          width: "full",
          raw: item,
        };
        segments.push(widgetSegment(fallback, { kind: "error", message: validated.error! }));
        continue;
      }
      const result = resolveWidgetData(rootDir, validated.spec, todayStr);
      segments.push(widgetSegment(validated.spec, result));
    }
  }

  return { title, summary, segments };
}
