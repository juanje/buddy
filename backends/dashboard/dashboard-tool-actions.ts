// backends/dashboard/dashboard-tool-actions.ts — dashboard() actions (FR-DASH-12).

import { basename, dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

import { toIsoDay } from "../../shared/dates";
import { DASHBOARDS_DIR_PREFIX } from "../../shared/dashboard/document";
import { inferInlineSourceDefinition } from "../../shared/dashboard/inline-source";
import { sectionsFit } from "../../shared/dashboard/sections";
import { replaceWidgetByTitle } from "../../shared/dashboard/rebuild";
import {
  listKnownSourceNames,
  sourceDefinition,
  type FieldType,
  type SourceDefinition,
} from "../../shared/dashboard/source-fields";
import { ViewableFileError, readViewableFile } from "../viewable-file";
import { loadSectionsSource } from "./sections-load";
import {
  listExampleDashboardPaths,
  resolveDashboardTemplate,
  bundledDashboardContent,
} from "./bundled-dashboards";
import {
  collectDashboardValidationIssues,
  formatValidationIssues,
} from "./validate-content";

const HELP_TEXT = `dashboard() actions:
- help — sources, views, query syntax, and a minimal example
- fields(source, path?) — field names and types (no rows)
- check(path) — whether a markdown file fits the sections primitive
- validate(content) — validation errors for dashboard markdown
- create(name, content | template) — write user/dashboards/<name>.md after validation
- update(name, widget_title, widget | content) — replace one widget or the whole file
- examples — copy bundled example dashboards to user/dashboards/examples/`;

export type DashboardActionParams = {
  source?: string;
  path?: string;
  content?: string;
  name?: string;
  template?: string;
  widget_title?: string;
  widget?: Record<string, unknown>;
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

function fieldsForSource(rootDir: string, source: string, path?: string): SourceDefinition | string {
  if (source === "sections") {
    if (!path) return "sections requires path";
    const loaded = loadSectionsSource(rootDir, path);
    if (!loaded.ok) return loaded.message;
    return loaded.def;
  }
  if (source === "inline") {
    return inferInlineSourceDefinition([]);
  }
  const def = sourceDefinition(source);
  if (!def) return `Unknown source '${source}'. Known: ${listKnownSourceNames().join(", ")}`;
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
  return `---\ntype: dashboard\ntitle: ${name}\n---\n\n${content.trim()}\n`;
}

function helpAction(): DashboardActionResult {
  const example = `Example:
\`\`\`dashboard
- view: counter
  title: Open tasks
  source: tasks
  count: true
\`\`\``;
  return ok(
    `${HELP_TEXT}\n\nSources: ${listKnownSourceNames().join(", ")}, sections, inline.\n` +
      `Views: kanban, list, table, counter, text, status.\n` +
      `Query keys: where, group, sort, limit, count, sum, range.\n\n${example}`,
  );
}

function fieldsAction(rootDir: string, params: DashboardActionParams): DashboardActionResult {
  const source = params.source;
  if (!source) return err("fields requires params.source");
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
  let content: string;
  try {
    content = readViewableFile(rootDir, path);
  } catch (e) {
    const message = e instanceof ViewableFileError ? e.message : String(e);
    return err(message);
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

  let nextContent: string;
  if (params.content) {
    nextContent = ensureDashboardFile(params.content, name.replace(/\.md$/i, ""));
  } else {
    const title = params.widget_title;
    const widget = params.widget;
    if (!title || !widget) {
      return err("update requires params.widget_title and params.widget, or params.content");
    }
    const replaced = replaceWidgetByTitle(existing, title, widget);
    if (!replaced.ok) return err(replaced.message);
    nextContent = replaced.content;
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
  for (const rel of paths) {
    const content = bundledDashboardContent(rel);
    if (!content) continue;
    const base = rel.replace(/^examples\//, "").replace(/\.md$/, "");
    const targetRel = `${DASHBOARDS_DIR_PREFIX}examples/${base}.md`;
    const abs = join(rootDir, targetRel);
    if (existsSync(abs)) {
      return err(`Example already exists: ${targetRel}. Remove it first or copy manually.`);
    }
    const issues = collectDashboardValidationIssues(rootDir, content);
    if (issues.length > 0) {
      return err(`Bundled example '${rel}' is invalid:\n${formatValidationIssues(issues)}`);
    }
    writeAtomic(rootDir, targetRel, content);
    written.push(targetRel);
  }
  return ok(`Copied ${written.length} example dashboard(s):\n${written.map((p) => `- ${p}`).join("\n")}`);
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
