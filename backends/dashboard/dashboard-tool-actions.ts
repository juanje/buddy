// backends/dashboard/dashboard-tool-actions.ts — dashboard() actions (FR-DASH-12).

import { basename, dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

import { toIsoDay } from "../../shared/dates";
import { DASHBOARDS_DIR_PREFIX, isDashboardDocument } from "../../shared/dashboard/document";
import { splitFrontmatter } from "../../shared/frontmatter";
import { inferInlineSourceDefinition } from "../../shared/dashboard/inline-source";
import { sectionsFit } from "../../shared/dashboard/sections";
import { replaceWidgetByTitle, setFrontmatterField } from "../../shared/dashboard/rebuild";
import {
  listKnownSourceNames,
  sourceDefinition,
  type FieldType,
  type SourceDefinition,
} from "../../shared/dashboard/source-fields";
import { ViewableFileError, readViewableFile } from "../viewable-file";
import { loadSectionsSource } from "./sections-load";
import { loadSeriesSource } from "./series-load";
import {
  listExampleDashboardPaths,
  resolveDashboardTemplate,
  bundledDashboardContent,
} from "./bundled-dashboards";
import {
  collectDashboardValidationIssues,
  formatValidationIssues,
} from "./validate-content";
import { dashboardViewFieldKeyHelp } from "../../shared/dashboard/schema";

const HELP_TEXT = `dashboard() actions (pass arguments in params):
- help — sources, views, query syntax, and a minimal example
- fields(source, path?) — field names and types (no rows); you do not need to read the file
- check(path) — whether a markdown file fits the sections primitive
- validate(content) — validation errors for dashboard markdown
- create(name, content | template) — write user/dashboards/<name>.md after validation
- update(name, ...) — validated before writing; one of:
    title?, summary? — change the dashboard header only
    widget_title + widget — replace the one widget with that title
    content — rewrite the whole file
- examples — copy bundled example dashboards to user/dashboards/examples/`;

export type DashboardActionParams = {
  source?: string;
  path?: string;
  content?: string;
  name?: string;
  template?: string;
  widget_title?: string;
  widget?: Record<string, unknown>;
  title?: string;
  summary?: string;
};

export type DashboardActionResult = { ok: true; text: string } | { ok: false; text: string };

function ok(text: string): DashboardActionResult {
  return { ok: true, text };
}

function err(text: string): DashboardActionResult {
  return { ok: false, text };
}

function formatFieldType(field: FieldType): string {
  if (field.kind === "enum") return `enum(${field.values.join("|")})`;
  return field.kind;
}

function listAllSourceNames(): string[] {
  return [...listKnownSourceNames(), "sections", "series", "inline"];
}

function paramsShapeHint(example: string): string {
  return `Expected params shape, e.g. params={${example}}`;
}

function fieldsForSource(rootDir: string, source: string, path?: string): SourceDefinition | string {
  if (source === "series") {
    if (!path) {
      return `series requires params.path. ${paramsShapeHint('source:"series", path:"user/data/file.csv"')}`;
    }
    const loaded = loadSeriesSource(rootDir, path);
    if (!loaded.ok) return loaded.message;
    return loaded.def;
  }
  if (source === "sections") {
    if (!path) {
      return `sections requires params.path. ${paramsShapeHint('source:"sections", path:"user/data/board-sections.md"')}`;
    }
    if (/\.csv$/i.test(path)) {
      return `CSV files use source: series, not sections. ${paramsShapeHint('source:"series", path:"user/data/file.csv"')}`;
    }
    const loaded = loadSectionsSource(rootDir, path);
    if (!loaded.ok) return loaded.message;
    return loaded.def;
  }
  if (source === "inline") {
    return inferInlineSourceDefinition([]);
  }
  const def = sourceDefinition(source);
  if (!def) {
    return `Unknown source '${source}'. Known: ${listAllSourceNames().join(", ")}`;
  }
  return def;
}

function dashboardRelPath(name: string): string {
  const base = name.replace(/\.md$/i, "").replace(/[/\\]/g, "");
  return `${DASHBOARDS_DIR_PREFIX}${base}.md`;
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

function ensureDashboardFile(content: string, name: string): string {
  if (content.includes("type: dashboard")) return content;
  if (/^---\r?\n[\s\S]*?\r?\n---/.test(content)) {
    return content.replace(/^---\r?\n/, "---\ntype: dashboard\n");
  }
  return `---\ntype: dashboard\ntitle: ${name}\n---\n\n${content.trim()}\n`;
}

function helpAction(): DashboardActionResult {
  const examples = `Examples:
\`\`\`dashboard
- view: counter
  title: Open tasks
  source: tasks
  count: true
\`\`\`

\`\`\`dashboard
- view: table
  title: European rows
  source: series
  path: user/data/paises.csv
  columns: [name, region]
  where: region = Europe
\`\`\`

\`\`\`dashboard
- view: list
  title: Names
  source: series
  path: user/data/sales.csv
  fields: [note]
\`\`\``;
  return ok(
    `${HELP_TEXT}\n\nSources: ${listAllSourceNames().join(", ")}.\n` +
      `File-backed: source 'sections' or 'series' requires params.path. ` +
      `Discover columns with fields(source, path) — you do not need to read the file.\n` +
      `Example: params={source:'series', path:'user/data/sales.csv'}.\n` +
      `Views: kanban, list, table, counter, text, status.\n` +
      `${dashboardViewFieldKeyHelp()}\n` +
      `Query keys: where, group, sort, limit, count, sum, range. ` +
      `Where syntax: one string per widget (not a YAML map); comparisons joined by ` +
      `'and'; operators =, !=, <, <=, >, >=, contains; relative dates like -30d; ` +
      `quote values starting with # or @ (example where: 'project = #buddy').\n` +
      `count/sum reduce rows to numbers and render only in view 'counter'.\n` +
      `WIP: source 'wip' gives one row per area with active fronts (distinct #projects ` +
      `plus loose tasks) against the configured limit; use view 'status' or ` +
      `'table' with where: over_by > 0. Never write the limit as inline text.\n\n${examples}`,
  );
}

function fieldsAction(rootDir: string, params: DashboardActionParams): DashboardActionResult {
  const source = params.source;
  if (!source) {
    return err(
      `fields requires params.source. ${paramsShapeHint('source:"tasks"')} or ${paramsShapeHint('source:"series", path:"user/data/x.csv"')}`,
    );
  }
  const def = fieldsForSource(rootDir, source, params.path);
  if (typeof def === "string") return err(def);
  const lines = Object.entries(def.fields).map(
    ([name, type]) => `- ${name}: ${formatFieldType(type)}`,
  );
  return ok(`Fields for '${source}':\n${lines.join("\n")}`);
}

function checkAction(rootDir: string, params: DashboardActionParams): DashboardActionResult {
  const path = params.path;
  if (!path) return err("check requires params.path");
  if (/\.csv$/i.test(path)) {
    const loaded = loadSeriesSource(rootDir, path);
    if (!loaded.ok) return err(loaded.message);
    return ok(`File is CSV. Use source: series with path: ${path}`);
  }
  let content: string;
  try {
    content = readViewableFile(rootDir, path);
  } catch (e) {
    const message = e instanceof ViewableFileError ? e.message : String(e);
    return err(message);
  }
  const normPath = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  const { fields } = splitFrontmatter(content);
  if (isDashboardDocument(normPath, fields)) {
    return ok(
      "File is already a dashboard (type: dashboard). Use action validate with params.content to check widgets.",
    );
  }
  if (sectionsFit(content)) {
    return ok(`File fits the sections primitive. Use source: sections with path: ${path}`);
  }
  const stem = basename(path).replace(/\.md$/i, "");
  const derived = `user/data/${stem}-sections.md`;
  return ok(
    `File does not fit the sections primitive (need ## headings with list items underneath).\n` +
      `Derived route: maintain ${derived} in sections shape, then reference it from the dashboard.`,
  );
}

function validateAction(rootDir: string, params: DashboardActionParams): DashboardActionResult {
  const content = params.content;
  if (!content) return err("validate requires params.content");
  const issues = collectDashboardValidationIssues(rootDir, content);
  if (issues.length === 0) return ok("Dashboard is valid.");
  return err(formatValidationIssues(issues));
}

function createAction(rootDir: string, params: DashboardActionParams): DashboardActionResult {
  const name = params.name;
  if (!name) return err("create requires params.name");
  if (params.template && params.content) {
    return err("Use either params.content or params.template, not both.");
  }
  let rawContent = params.content;
  if (params.template) {
    const fromTemplate = resolveDashboardTemplate(params.template);
    if (!fromTemplate) {
      return err(
        `Unknown template '${params.template}'. Available: mis-tareas, mi-semana.`,
      );
    }
    rawContent = fromTemplate;
  }
  if (!rawContent) return err("create requires params.content or params.template");
  const rel = dashboardRelPath(name);
  const abs = join(rootDir, rel);
  if (existsSync(abs)) return err(`Dashboard already exists: ${rel}`);
  const content = ensureDashboardFile(rawContent, name.replace(/\.md$/i, ""));
  const issues = collectDashboardValidationIssues(rootDir, content);
  if (issues.length > 0) return err(`Refused — invalid dashboard:\n${formatValidationIssues(issues)}`);
  writeAtomic(rootDir, rel, content);
  return ok(`Created ${rel}`);
}

function updateAction(rootDir: string, params: DashboardActionParams): DashboardActionResult {
  const name = params.name;
  if (!name) return err("update requires params.name");
  const rel = dashboardRelPath(name);
  const abs = join(rootDir, rel);
  if (!existsSync(abs)) return err(`Dashboard not found: ${rel}`);
  const existing = readFileSync(abs, "utf8");

  const header: Array<["title" | "summary", string]> = [];
  for (const key of ["title", "summary"] as const) {
    const value = params[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim() === "" || /[\r\n]/.test(value)) {
      return err(`params.${key} must be a non-empty single line`);
    }
    header.push([key, value.trim()]);
  }

  let nextContent: string;
  if (params.content) {
    nextContent = ensureDashboardFile(params.content, name.replace(/\.md$/i, ""));
  } else if (params.widget_title || params.widget) {
    const title = params.widget_title;
    const widget = params.widget;
    if (!title || !widget) {
      return err("update with a widget requires both params.widget_title and params.widget");
    }
    const replaced = replaceWidgetByTitle(existing, title, widget);
    if (!replaced.ok) return err(replaced.message);
    nextContent = replaced.content;
  } else if (header.length > 0) {
    nextContent = existing;
  } else {
    return err(
      "update requires one of: params.title/summary (header only), " +
        "params.widget_title + params.widget (one widget), or params.content (whole file)",
    );
  }
  for (const [key, value] of header) {
    nextContent = setFrontmatterField(nextContent, key, value);
  }

  const issues = collectDashboardValidationIssues(rootDir, nextContent);
  if (issues.length > 0) return err(`Refused — invalid dashboard:\n${formatValidationIssues(issues)}`);
  writeAtomic(rootDir, rel, nextContent);
  return ok(`Updated ${rel}`);
}

const HANDLERS: Record<
  string,
  (rootDir: string, params: DashboardActionParams) => DashboardActionResult
> = {
  help: () => helpAction(),
  fields: fieldsAction,
  check: checkAction,
  validate: validateAction,
  create: createAction,
  update: updateAction,
  examples: examplesAction,
};

function examplesAction(rootDir: string): DashboardActionResult {
  const paths = listExampleDashboardPaths();
  if (paths.length === 0) {
    return err("No bundled example dashboards found.");
  }
  const written: string[] = [];
  const already: string[] = [];
  for (const rel of paths) {
    const content = bundledDashboardContent(rel);
    if (!content) continue;
    const base = rel.replace(/^examples\//, "").replace(/\.md$/, "");
    const targetRel = `${DASHBOARDS_DIR_PREFIX}examples/${base}.md`;
    const abs = join(rootDir, targetRel);
    if (existsSync(abs)) {
      already.push(targetRel);
      continue;
    }
    const issues = collectDashboardValidationIssues(rootDir, content);
    if (issues.length > 0) {
      return err(`Bundled example '${rel}' is invalid:\n${formatValidationIssues(issues)}`);
    }
    writeAtomic(rootDir, targetRel, content);
    written.push(targetRel);
  }
  const parts: string[] = [];
  if (written.length > 0) {
    parts.push(
      `Copied ${written.length} example dashboard(s):\n${written.map((p) => `- ${p}`).join("\n")}`,
    );
  }
  if (already.length > 0) {
    parts.push(
      `Already present (${already.length}):\n${already.map((p) => `- ${p}`).join("\n")}`,
    );
  }
  if (parts.length === 0) {
    return err("No bundled example dashboards found.");
  }
  return ok(parts.join("\n\n"));
}

export function classifyDashboardAction(action: string): "allow" | "deny" {
  return Object.hasOwn(HANDLERS, action) ? "allow" : "deny";
}

export function executeDashboardAction(
  rootDir: string,
  action: string,
  params: DashboardActionParams = {},
): DashboardActionResult {
  const handler = HANDLERS[action];
  if (!handler) {
    return err(`Unknown action '${action}'. Use action='help' to see available actions.`);
  }
  return handler(rootDir, params);
}

export function dashboardResultToText(result: DashboardActionResult): string {
  return result.text;
}
