// backends/dashboard/resolve.ts — Resolve dashboard markdown to a view model (FR-DASH-01+).

import { toIsoDay } from "../../shared/dates";
import { parseDashboardDocument, parseDashboardParts } from "../../shared/dashboard/parse";
import { validateWidgetSpec } from "../../shared/dashboard/schema";
import type {
  ResolvedDashboard,
  ResolvedSegment,
  ResolvedWidgetSegment,
  WidgetProvenance,
  WidgetResult,
  WidgetSpec,
} from "../../shared/dashboard/types";
import { parseDashboardYamlBlock } from "../../shared/dashboard/yaml-blocks";
import { applyWidgetQuery } from "../../shared/dashboard/query";
import {
  ageDaysFromUpdated,
  inferInlineSourceDefinition,
  parseInlineRows,
  validateInlineMetadata,
} from "../../shared/dashboard/inline-source";
import type { SourceDefinition } from "../../shared/dashboard/source-fields";
import { sourceDefinition } from "../../shared/dashboard/source-fields";
import { validateViewParams } from "../../shared/dashboard/view-params";
import { loadSectionsSource } from "./sections-load";
import { loadSeriesSource } from "./series-load";
import { loadSourceRows } from "./sources";

function resolveTextWidget(spec: WidgetSpec): WidgetResult {
  const text = spec.raw.text;
  return { kind: "text", text: typeof text === "string" ? text : "" };
}

function inlineProvenance(raw: Record<string, unknown>, today: string): WidgetProvenance | undefined {
  const updated = raw.updated;
  const basis = raw.basis;
  if (typeof updated !== "string" || typeof basis !== "string") return undefined;
  return {
    updated,
    basis,
    ageDays: ageDaysFromUpdated(updated, today),
  };
}

function loadInlineSource(
  spec: WidgetSpec,
  today: string,
): { ok: true; rows: Record<string, unknown>[]; def: SourceDefinition; provenance: WidgetProvenance } | { ok: false; message: string } {
  const metaErr = validateInlineMetadata(spec.raw);
  if (metaErr) return { ok: false, message: metaErr };

  if (spec.view === "text") {
    const text = spec.raw.text;
    if (typeof text !== "string") {
      return { ok: false, message: "Inline text view requires 'text' markdown content" };
    }
    const provenance = inlineProvenance(spec.raw, today)!;
    return {
      ok: true,
      rows: [],
      def: { fields: { text: { kind: "string" } } },
      provenance,
    };
  }

  const parsed = parseInlineRows(spec.raw);
  if (typeof parsed === "string") return { ok: false, message: parsed };
  const provenance = inlineProvenance(spec.raw, today)!;
  return {
    ok: true,
    rows: parsed,
    def: inferInlineSourceDefinition(parsed),
    provenance,
  };
}

function resolveWidgetData(
  rootDir: string,
  spec: WidgetSpec,
  today: string,
): { result: WidgetResult; provenance?: WidgetProvenance } {
  if (spec.view === "text" && !spec.source) {
    return { result: resolveTextWidget(spec) };
  }

  if (spec.source === "sections") {
    const path = spec.raw.path;
    if (typeof path !== "string" || path.trim() === "") {
      return { result: { kind: "error", message: "sections source requires key 'path'" } };
    }
    const loaded = loadSectionsSource(rootDir, path);
    if (!loaded.ok) {
      return { result: { kind: "error", message: loaded.message } };
    }
    const viewErr = validateViewParams(spec, loaded.def);
    if (viewErr) {
      return { result: { kind: "error", message: viewErr } };
    }
    const queried = applyWidgetQuery(loaded.rows, spec, "sections", loaded.def, today);
    if (!queried.ok) {
      return { result: { kind: "error", message: queried.message } };
    }
    return { result: queried.result };
  }

  if (spec.source === "series") {
    const path = spec.raw.path;
    if (typeof path !== "string" || path.trim() === "") {
      return { result: { kind: "error", message: "series source requires key 'path'" } };
    }
    const loaded = loadSeriesSource(rootDir, path);
    if (!loaded.ok) {
      return { result: { kind: "error", message: loaded.message } };
    }
    const viewErr = validateViewParams(spec, loaded.def);
    if (viewErr) {
      return { result: { kind: "error", message: viewErr } };
    }
    const queried = applyWidgetQuery(loaded.rows, spec, "series", loaded.def, today);
    if (!queried.ok) {
      return { result: { kind: "error", message: queried.message } };
    }
    return { result: queried.result };
  }

  if (spec.source === "inline") {
    const loaded = loadInlineSource(spec, today);
    if (!loaded.ok) {
      return { result: { kind: "error", message: loaded.message } };
    }
    const viewErr2 = validateViewParams(spec, loaded.def);
    if (viewErr2) {
      return { result: { kind: "error", message: viewErr2 } };
    }
    if (spec.view === "text") {
      return {
        result: { kind: "text", text: String(spec.raw.text) },
        provenance: loaded.provenance,
      };
    }
    const queried = applyWidgetQuery(loaded.rows, spec, "inline", loaded.def, today);
    if (!queried.ok) {
      return { result: { kind: "error", message: queried.message } };
    }
    return { result: queried.result, provenance: loaded.provenance };
  }

  const source = spec.source;
  if (!source) {
    return { result: { kind: "error", message: `View '${spec.view}' requires a source` } };
  }
  const loaded = loadSourceRows(rootDir, source, today);
  if (!loaded.ok) {
    return { result: { kind: "error", message: loaded.message } };
  }
  const def = sourceDefinition(source);
  if (!def) {
    return { result: { kind: "error", message: `Unknown source '${source}'` } };
  }
  const viewErr3 = validateViewParams(spec, def);
  if (viewErr3) {
    return { result: { kind: "error", message: viewErr3 } };
  }
  const queried = applyWidgetQuery(loaded.rows, spec, source, def, today);
  if (!queried.ok) {
    return { result: { kind: "error", message: queried.message } };
  }
  return { result: queried.result };
}

function widgetSegment(
  spec: WidgetSpec,
  result: WidgetResult,
  provenance?: WidgetProvenance,
  position?: ResolvedWidgetSegment["position"],
): ResolvedSegment {
  return { kind: "widget", spec, result, provenance, position };
}

function errorWidget(
  message: string,
  spec?: WidgetSpec,
  position?: ResolvedWidgetSegment["position"],
): ResolvedSegment {
  const fallback: WidgetSpec = spec ?? { view: "text", width: "full", raw: {} };
  return widgetSegment(fallback, { kind: "error", message }, undefined, position);
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
    const blockPos = { block: part.block };
    if (part.fenceError) {
      segments.push(errorWidget(part.fenceError, undefined, blockPos));
      continue;
    }
    const parsed = parseDashboardYamlBlock(part.yaml);
    if (!parsed.ok) {
      segments.push(errorWidget(parsed.message, undefined, blockPos));
      continue;
    }
    let widgetNum = 0;
    for (const item of parsed.items) {
      widgetNum += 1;
      const widgetPos = { block: part.block, widget: widgetNum };
      const validated = validateWidgetSpec(item);
      if (validated.error || !validated.spec) {
        const fallback: WidgetSpec = {
          view: typeof item.view === "string" ? item.view : "text",
          width: "full",
          raw: item,
        };
        segments.push(
          widgetSegment(fallback, { kind: "error", message: validated.error! }, undefined, widgetPos),
        );
        continue;
      }
      const resolved = resolveWidgetData(rootDir, validated.spec, todayStr);
      segments.push(
        widgetSegment(validated.spec, resolved.result, resolved.provenance, widgetPos),
      );
    }
  }

  return { title, summary, today: todayStr, segments };
}
