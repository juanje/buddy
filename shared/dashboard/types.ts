// shared/dashboard/types.ts — Resolved dashboard model (FR-DASH-01).

export type WidgetWidth = "full" | "half" | "third";

export type WidgetSpec = {
  view: string;
  source?: string;
  title?: string;
  width?: WidgetWidth;
  /** Raw keys from the YAML item before validation strips unknowns. */
  raw: Record<string, unknown>;
};

export type WidgetResult =
  | { kind: "rows"; rows: Record<string, unknown>[] }
  | { kind: "groups"; groups: Array<{ key: string | null; rows: Record<string, unknown>[] }> }
  | { kind: "value"; value: number; delta?: number }
  | { kind: "group_values"; groups: Array<{ key: string | null; value: number }> }
  | { kind: "text"; text: string }
  | { kind: "error"; message: string };

export type WidgetProvenance = {
  updated: string;
  basis: string;
  ageDays: number;
};

export type ResolvedTextSegment = { kind: "text"; markdown: string };

export type WidgetPosition = {
  /** 1-based index among ```dashboard blocks only. */
  block: number;
  /** 1-based widget index inside the block, when the error is widget-scoped. */
  widget?: number;
};

export type ResolvedWidgetSegment = {
  kind: "widget";
  spec: WidgetSpec;
  result: WidgetResult;
  provenance?: WidgetProvenance;
  position?: WidgetPosition;
};

export type ResolvedSegment = ResolvedTextSegment | ResolvedWidgetSegment;

export type ResolvedDashboard = {
  title?: string;
  summary?: string;
  /** Local calendar day used for relative dates (FR-DASH-04, FR-DASH-09). */
  today: string;
  segments: ResolvedSegment[];
};
