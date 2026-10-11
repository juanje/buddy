// backends/data/data-tool-actions.ts — data() actions (FR-DATA-02).

import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { findRegistryEntry } from "../../shared/data/registry-lookup";
import { DATA_REGISTRY_RELPATH } from "../../shared/data/registry-path";
import {
  parseDataRegistryDocument,
  upsertRegistryEntry,
  validateEntryForDefine,
  type DataRegistryEntry,
} from "../../shared/data/registry";
import {
  appendSeriesRow,
  correctSeriesRow,
  parseKeyMap,
  parseValuesMap,
  writeAtomic,
} from "./series-file";

export type DataActionParams = Record<string, unknown>;

export type DataActionResult = { ok: true; text: string } | { ok: false; text: string };

function ok(text: string): DataActionResult {
  return { ok: true, text };
}

function err(text: string): DataActionResult {
  return { ok: false, text };
}

function helpAction(): DataActionResult {
  return ok(
    `data() actions (pass arguments in params):
- help — registry format, define, list; no need to read CSV rows for schema
- define(name, kind, key, columns, ...) — add or replace one entry in user/data/index.md.
  define does not create the CSV.
  Example: params={name:'migranas', kind:'series', key:['fecha','hora'], columns:{fecha:'date', hora:'string', intensidad:'number'}}
  Column types: string, number, date. The name is a slug (lowercase ascii, hyphens).
- list — entry names, paths, and modes
- append(name, values:{...}) — add one row to a registered series CSV
  Example: params={name:'migranas', values:{fecha:'2026-10-11', hora:'09:00', intensidad:7}}
- correct(name, key:{...}, set:{...}) — update non-key fields on an existing row
  Example: params={name:'migranas', key:{fecha:'2026-10-11', hora:'09:00'}, set:{intensidad:8}}
  Use remove:true to delete the row (no set).

Sprint 4b supports kind: series only. kind: sections or records is not supported yet;
feed dashboards from the file directly (unregistered).`,
  );
}

function requireEntry(
  rootDir: string,
  params: DataActionParams,
): DataRegistryEntry | { ok: false; text: string } {
  const name = params.name;
  if (typeof name !== "string" || !name.trim()) {
    return err("name is required.");
  }
  const entry = findRegistryEntry(rootDir, name.trim());
  if (!entry) return err(`No registered entry named '${name.trim()}'.`);
  return entry;
}

function appendAction(rootDir: string, params: DataActionParams): DataActionResult {
  const entryOrErr = requireEntry(rootDir, params);
  if ("ok" in entryOrErr) return entryOrErr;
  const entry = entryOrErr;
  const values = parseValuesMap(params.values);
  if (typeof values === "string") return err(values);
  const result = appendSeriesRow(rootDir, entry, values);
  if (!result.ok) return err(result.message);
  return ok(`Appended row to ${entry.path}`);
}

function correctAction(rootDir: string, params: DataActionParams): DataActionResult {
  const entryOrErr = requireEntry(rootDir, params);
  if ("ok" in entryOrErr) return entryOrErr;
  const entry = entryOrErr;
  const key = parseKeyMap(params.key);
  if (typeof key === "string") return err(key);
  const remove = params.remove === true;
  const setRaw = params.set;
  const set =
    setRaw === undefined
      ? undefined
      : typeof setRaw === "object" && !Array.isArray(setRaw)
        ? (setRaw as Record<string, unknown>)
        : undefined;
  if (!remove && !set) {
    return err("correct requires params.set or remove:true");
  }
  const result = correctSeriesRow(rootDir, entry, key, { remove, set });
  if (!result.ok) return err(result.message);
  if (!result.changed) {
    return ok(remove ? "No row matched key; nothing removed." : "No row matched key; nothing changed.");
  }
  return ok(remove ? `Removed row from ${entry.path}` : `Updated row in ${entry.path}`);
}

function columnsFromParams(params: DataActionParams): Record<string, string> | string {
  const given = params.columns;
  if (given !== undefined) {
    if (!given || typeof given !== "object" || Array.isArray(given)) {
      return "columns must be a mapping of name to type, for example columns:{fecha:'date', hora:'string', intensidad:'number'}";
    }
    const columns: Record<string, string> = {};
    for (const [name, type] of Object.entries(given as Record<string, unknown>)) {
      if (typeof type !== "string") {
        return `Column '${name}' type must be a string (string, number, or date)`;
      }
      columns[name] = type;
    }
    return columns;
  }
  const columns: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith("column_") || typeof value !== "string") continue;
    columns[key.slice("column_".length)] = value;
  }
  return columns;
}

function defineAction(rootDir: string, params: DataActionParams): DataActionResult {
  const name = params.name;
  if (typeof name !== "string" || !name.trim()) {
    return err("define requires params.name.");
  }
  const kind = params.kind;
  if (kind === "sections" || kind === "records") {
    return err(
      `${kind} is not supported yet; feed dashboards from the file directly (unregistered).`,
    );
  }

  const keyRaw = params.key;
  let key: string | string[] | undefined;
  if (typeof keyRaw === "string") {
    key = keyRaw.includes(",")
      ? keyRaw.split(",").map((k) => k.trim()).filter(Boolean)
      : keyRaw.trim();
  } else if (Array.isArray(keyRaw)) {
    const parts = keyRaw.filter((k): k is string => typeof k === "string" && k.trim() !== "");
    if (parts.length !== keyRaw.length || parts.length === 0) {
      return err("key must be a column name or a list of column names");
    }
    key = parts.map((k) => k.trim());
  }

  const columns = columnsFromParams(params);
  if (typeof columns === "string") return err(columns);

  const raw: Record<string, unknown> = {
    kind,
    path: params.path,
    key,
    columns,
    mode: params.mode,
    inferred: params.inferred,
    sensitive: params.sensitive,
    instructions: params.instructions,
  };

  const validated = validateEntryForDefine(name.trim(), raw);
  if (typeof validated === "string") return err(validated);
  const entry: DataRegistryEntry = validated;

  const abs = join(rootDir, DATA_REGISTRY_RELPATH);
  const prior = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  const next = upsertRegistryEntry(prior, entry);
  writeAtomic(rootDir, DATA_REGISTRY_RELPATH, next);
  return ok(`Registered '${entry.name}' at ${entry.path}`);
}

function listAction(rootDir: string): DataActionResult {
  const abs = join(rootDir, DATA_REGISTRY_RELPATH);
  if (!existsSync(abs)) {
    return ok("No entries registered.");
  }
  const parsed = parseDataRegistryDocument(readFileSync(abs, "utf8"));
  if (parsed.entries.length === 0 && parsed.errors.length === 0) {
    return ok("No entries registered.");
  }
  const lines = parsed.entries.map(
    (e) => `- ${e.name} (${e.path}) mode ${e.mode}`,
  );
  const errLines = parsed.errors.map((e) => `- ${e.name}: ${e.message} (skipped)`);
  return ok([...lines, ...errLines].join("\n"));
}

const HANDLERS: Record<string, (rootDir: string, params: DataActionParams) => DataActionResult> = {
  help: () => helpAction(),
  define: defineAction,
  list: listAction,
  append: appendAction,
  correct: correctAction,
};

export function classifyDataAction(action: string): "allow" | "deny" {
  return Object.hasOwn(HANDLERS, action) ? "allow" : "deny";
}

export function executeDataAction(
  rootDir: string,
  action: string,
  params: DataActionParams = {},
): DataActionResult {
  const handler = HANDLERS[action];
  if (!handler) {
    return err(`Unknown action '${action}'. Use action='help' to see available actions.`);
  }
  return handler(rootDir, params);
}

export function dataResultToText(result: DataActionResult): string {
  return result.text;
}
