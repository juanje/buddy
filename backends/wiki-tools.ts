// backends/wiki-tools.ts — Single entry point for wiki tools (FR-WIKI-07).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { globalConfigPath } from "./global-config";
import { detectFirstRun } from "./setup";
import { buildWikiFileTool } from "./wiki-file";
import { buildWikiSearchTool } from "./wiki-search";
import type { WikiLanguage } from "./wiki-format";

/** Instance UI language from ~/.buddy/config.json; defaults to en when unconfigured. */
export function resolveInstanceLanguage(): WikiLanguage {
  const state = detectFirstRun(globalConfigPath());
  if (state.firstRun) return "en";
  return state.config.language === "es" ? "es" : "en";
}

export function buildWikiTools(rootDir: string, language?: WikiLanguage): ToolDefinition[] {
  const lang = language ?? resolveInstanceLanguage();
  return [...buildWikiSearchTool(rootDir), ...buildWikiFileTool(rootDir, lang)];
}
