// backends/data/data-tool-actions.ts — data() actions (FR-DATA-02).

import { basename, dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

import { DATA_REGISTRY_RELPATH } from "../../shared/data/registry-path";
import {
  parseDataRegistryDocument,
  upsertRegistryEntry,
  validateEntryForDefine,
  type DataRegistryEntry,
} from "../../shared/data/registry";

export type DataActionParams = Record<string, unknown>;

export type DataActionResult = { ok: true; text: string } | { ok: false; text: string };

function ok(text: string): DataActionResult {
  return { ok: true, text };
}

function err(text: string): DataActionResult {
  return { ok: false, text };
}

function writeAtomic(rootDir: string, relPath: string, content: string): void {
  const abs = join(rootDir, relPath);
  const dir = dirname(abs);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${basename(abs)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, abs);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // ignore
    }
    throw error;
  }
}

function helpAction(): DataActionResult {
  return ok(
    `data() actions (pass arguments in params):
- help — registry format, define, list; no need to read CSV rows for schema
- define(name, kind, key, columns, ...) — add or replace one entry in user/data/index.md
- list — entry names, paths, and modes (inactive until sprint 6)

Sprint 4b supports kind: series only. kind: sections or records is not supported yet;
feed dashboards from the file directly (unregistered). Row writes (append, correct) come later.`,
  );
}

function columnsFromParams(params: DataActionParams): Record<string, string> {
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
  }

  const raw: Record<string, unknown> = {
    kind,
    path: params.path,
    key,
    columns: columnsFromParams(params),
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
    (e) =>
      `- ${e.name} (${e.path}) mode ${e.mode} (inactive until sprint 6)`,
  );
  const errLines = parsed.errors.map((e) => `- ${e.name}: ${e.message} (skipped)`);
  return ok([...lines, ...errLines].join("\n"));
}

const HANDLERS: Record<string, (rootDir: string, params: DataActionParams) => DataActionResult> = {
  help: () => helpAction(),
  define: defineAction,
  list: listAction,
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
