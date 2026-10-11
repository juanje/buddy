// shared/data/registry.ts — Parse user/data/index.md entries (FR-DATA-01).

import { parseDocument } from "yaml";

export type DataColumnType = "string" | "number" | "date";
export type DataUpdateMode = "on_mention" | "consolidation" | "on_request";

export type DataRegistryEntry = {
  name: string;
  path: string;
  kind: "series";
  key: string | string[];
  columns: Record<string, DataColumnType>;
  mode: DataUpdateMode;
  inferred: boolean;
  sensitive: boolean;
  instructions?: string;
};

export type DataRegistryParseError = { name: string; message: string };

export type ParseDataRegistryResult = {
  entries: DataRegistryEntry[];
  errors: DataRegistryParseError[];
};

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const OPEN_DATA = /^```data\s*$/;
const CLOSE_FENCE = /^```\s*$/;
const RESERVED_COLUMNS = new Set(["origin", "basis"]);
const COLUMN_TYPES = new Set<DataColumnType>(["string", "number", "date"]);
const MODES = new Set<DataUpdateMode>(["on_mention", "consolidation", "on_request"]);

function parseDataYamlBlock(yaml: string): { ok: true; raw: Record<string, unknown> } | { ok: false; message: string } {
  const doc = parseDocument(yaml, { schema: "core", uniqueKeys: true });
  if (doc.errors.length > 0) {
    return { ok: false, message: doc.errors[0]?.message ?? "Invalid YAML in data block" };
  }
  let js: unknown;
  try {
    js = doc.toJS({ maxAliasCount: 20 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
  if (!js || typeof js !== "object" || Array.isArray(js)) {
    return { ok: false, message: "Data block must be a YAML mapping" };
  }
  return { ok: true, raw: js as Record<string, unknown> };
}

function extractDataBlock(sectionBody: string): { yaml: string } | { error: string } {
  const lines = sectionBody.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!OPEN_DATA.test(lines[i].trim())) continue;
    const yamlLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (CLOSE_FENCE.test(lines[j].trim())) {
        return { yaml: yamlLines.join("\n") };
      }
      yamlLines.push(lines[j]);
    }
    return { error: "Unclosed data block" };
  }
  return { error: "Missing ```data block" };
}

function normalizeKey(raw: unknown): string[] | undefined {
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  if (Array.isArray(raw)) {
    const keys = raw.filter((k): k is string => typeof k === "string" && k.trim() !== "");
    if (keys.length === raw.length && keys.length > 0) return keys.map((k) => k.trim());
  }
  return undefined;
}

function validateInstructions(raw: unknown): string | undefined | { error: string } {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return { error: "instructions must be a string" };
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const lines = trimmed.split(/\r?\n/);
  if (lines.length > 3) return { error: "instructions must be at most 3 lines" };
  if (trimmed.length > 400) return { error: "instructions must be at most 400 characters" };
  return trimmed;
}

function validateEntry(name: string, raw: Record<string, unknown>): DataRegistryEntry | { error: string } {
  if (!NAME_RE.test(name)) {
    return { error: `Entry name '${name}' is not a valid slug` };
  }

  const kind = raw.kind;
  if (kind !== "series") {
    return { error: "kind must be 'series' in sprint 4b" };
  }

  const path =
    typeof raw.path === "string" && raw.path.trim()
      ? raw.path.trim().replace(/\\/g, "/")
      : `user/data/${name}.csv`;
  if (!path.startsWith("user/data/") || !path.endsWith(".csv")) {
    return { error: "path must be under user/data/ and end with .csv" };
  }

  const keyParts = normalizeKey(raw.key);
  if (!keyParts) return { error: "key must be a column name or a list of column names" };

  const columnsRaw = raw.columns;
  if (!columnsRaw || typeof columnsRaw !== "object" || Array.isArray(columnsRaw)) {
    return { error: "columns must be a mapping of name to type" };
  }
  const columns: Record<string, DataColumnType> = {};
  for (const [colName, colType] of Object.entries(columnsRaw as Record<string, unknown>)) {
    if (RESERVED_COLUMNS.has(colName)) {
      return { error: `Column '${colName}' is reserved` };
    }
    if (typeof colType !== "string" || !COLUMN_TYPES.has(colType as DataColumnType)) {
      return { error: `Column '${colName}' has invalid type` };
    }
    columns[colName] = colType as DataColumnType;
  }
  if (Object.keys(columns).length === 0) {
    return { error: "columns must list at least one field" };
  }
  for (const k of keyParts) {
    if (!columns[k]) return { error: `key field '${k}' is not in columns` };
  }

  let mode: DataUpdateMode = "on_request";
  if (raw.mode !== undefined && raw.mode !== null) {
    if (typeof raw.mode !== "string" || !MODES.has(raw.mode as DataUpdateMode)) {
      if (raw.mode === "snapshot") return { error: "mode 'snapshot' is not supported yet" };
      return { error: "mode must be on_mention, consolidation, or on_request" };
    }
    mode = raw.mode as DataUpdateMode;
  }

  const inferred = raw.inferred === true;
  const sensitive = raw.sensitive === true;

  const instructionsResult = validateInstructions(raw.instructions);
  if (instructionsResult && typeof instructionsResult === "object" && "error" in instructionsResult) {
    return instructionsResult;
  }

  return {
    name,
    path,
    kind: "series",
    key: keyParts.length === 1 ? keyParts[0]! : keyParts,
    columns,
    mode,
    inferred,
    sensitive,
    instructions: typeof instructionsResult === "string" ? instructionsResult : undefined,
  };
}

/** Parse registry markdown; invalid entries appear in `errors` only. */
export function parseDataRegistryDocument(content: string): ParseDataRegistryResult {
  const entries: DataRegistryEntry[] = [];
  const errors: DataRegistryParseError[] = [];
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (!heading) {
      i += 1;
      continue;
    }
    const name = heading[1].trim();
    const bodyLines: string[] = [];
    i += 1;
    while (i < lines.length && !/^##\s+/.test(lines[i])) {
      bodyLines.push(lines[i]);
      i += 1;
    }
    const block = extractDataBlock(bodyLines.join("\n"));
    if ("error" in block) {
      errors.push({ name, message: block.error });
      continue;
    }
    const parsed = parseDataYamlBlock(block.yaml);
    if (!parsed.ok) {
      errors.push({ name, message: parsed.message });
      continue;
    }
    const validated = validateEntry(name, parsed.raw);
    if ("error" in validated) {
      errors.push({ name, message: validated.error });
      continue;
    }
    entries.push(validated);
  }
  return { entries, errors };
}
