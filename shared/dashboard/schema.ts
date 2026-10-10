// shared/dashboard/schema.ts — Widget validation (FR-DASH-01, FR-DASH-10).

import type { WidgetSpec, WidgetWidth } from "./types";

const V1_VIEWS = new Set(["kanban", "list", "table", "counter", "text", "status"]);

const QUERY_KEYS = ["where", "group", "sort", "limit", "count", "sum", "range"] as const;

const INLINE_KEYS = ["updated", "basis", "rows"] as const;

const COMMON_KEYS = new Set(["view", "source", "title", "width", ...QUERY_KEYS, ...INLINE_KEYS]);

const VIEW_EXTRA_KEYS: Record<string, Set<string>> = {
  kanban: new Set(["fields", "group", "order"]),
  list: new Set(["fields"]),
  table: new Set(["columns"]),
  counter: new Set(["delta"]),
  text: new Set(["text"]),
  status: new Set([]),
};

export type ValidateWidgetResult = {
  spec?: WidgetSpec;
  error?: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function allowedKeysForView(view: string): Set<string> {
  const extra = VIEW_EXTRA_KEYS[view] ?? new Set<string>();
  return new Set([...COMMON_KEYS, ...extra]);
}

function parseWidth(value: unknown): WidgetWidth | string | undefined {
  if (value === undefined) return "full";
  if (value === "full" || value === "half" || value === "third") return value;
  return `width must be full, half, or third (got ${JSON.stringify(value)})`;
}

export function validateWidgetSpec(rawItem: Record<string, unknown>): ValidateWidgetResult {
  const view = asString(rawItem.view);
  if (!view) {
    return { error: "Widget is missing required key 'view'" };
  }
  if (!V1_VIEWS.has(view)) {
    return { error: `Unknown view '${view}'. Allowed views: ${[...V1_VIEWS].join(", ")}` };
  }

  const allowed = allowedKeysForView(view);
  const unknown = Object.keys(rawItem).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    return {
      error: `Unknown key '${unknown[0]}'. Allowed keys for view '${view}': ${[...allowed].sort().join(", ")}`,
    };
  }

  const widthParsed = parseWidth(rawItem.width);
  if (typeof widthParsed === "string" && widthParsed.startsWith("width must")) {
    return { error: widthParsed };
  }

  const source = asString(rawItem.source);

  if (view === "text") {
    const text = asString(rawItem.text);
    if (text === undefined) {
      return { error: "Text view requires key 'text'" };
    }
  } else if (source === "inline") {
    // FR-DASH-09: metadata validated in resolve with view-params
  } else if (!source) {
    return { error: `View '${view}' requires key 'source'` };
  }

  const spec: WidgetSpec = {
    view,
    source,
    title: asString(rawItem.title),
    width: (widthParsed as WidgetWidth) ?? "full",
    raw: rawItem,
  };
  return { spec };
}
