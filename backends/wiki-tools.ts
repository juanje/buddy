// backends/wiki-tools.ts — Single entry point for wiki tools (FR-WIKI-07).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { buildWikiFileTool } from "./wiki-file";
import { buildWikiSearchTool } from "./wiki-search";

export function buildWikiTools(rootDir: string): ToolDefinition[] {
  return [...buildWikiSearchTool(rootDir), ...buildWikiFileTool(rootDir)];
}
