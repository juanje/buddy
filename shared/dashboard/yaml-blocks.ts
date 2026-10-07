// shared/dashboard/yaml-blocks.ts — Parse fenced dashboard YAML (FR-DASH-01).

import { parseDocument } from "yaml";

export type ParsedYamlBlock =
  | { ok: true; items: Record<string, unknown>[] }
  | { ok: false; message: string };

export function parseDashboardYamlBlock(yaml: string): ParsedYamlBlock {
  const doc = parseDocument(yaml, { schema: "core", uniqueKeys: true });
  if (doc.errors.length > 0) {
    return { ok: false, message: doc.errors[0]?.message ?? "Invalid YAML in dashboard block" };
  }
  let js: unknown;
  try {
    js = doc.toJS({ maxAliasCount: 20 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
  if (!Array.isArray(js)) {
    return { ok: false, message: "Dashboard block must be a YAML list of widgets" };
  }
  const items: Record<string, unknown>[] = [];
  for (const entry of js) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      items.push(entry as Record<string, unknown>);
    } else {
      return { ok: false, message: "Each widget must be a YAML mapping" };
    }
  }
  return { ok: true, items };
}
