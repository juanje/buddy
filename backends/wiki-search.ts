// backends/wiki-search.ts — FR-WIKI-04: metadata-only wiki search.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { WIKI_DIR } from "../shared/brain-paths";
import { buddyPath } from "./brain-paths";
import {
  extractConnections,
  extractTitle,
  parseWikiFrontmatter,
  type WikiPageMetadata,
} from "./wiki-format";
import { listWikiPageRelPaths } from "./wiki-index";

export type WikiSearchScope = "tags" | "titles" | "content" | "all";

export interface WikiSearchResult extends WikiPageMetadata {
  relPath: string;
}

export interface WikiSearchOutput {
  results: WikiSearchResult[];
  total: number;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function loadPageMetadata(wikiDir: string, relPath: string): WikiSearchResult {
  const content = readFileSync(join(wikiDir, relPath), "utf8");
  const fm = parseWikiFrontmatter(content);
  return {
    relPath,
    title: extractTitle(content),
    summary: fm.summary,
    tags: fm.tags,
    category: relPath.includes("/") ? relPath.split("/")[0] : "",
    connections: extractConnections(content),
  };
}

function pageMatches(
  page: WikiSearchResult,
  content: string,
  query: string,
  scope: WikiSearchScope,
): boolean {
  if (!query) return false;

  const titleMatch = page.title.toLowerCase().includes(query);
  const summaryMatch = page.summary.toLowerCase().includes(query);
  const tagMatch = page.tags.some((tag) => tag === query);
  const bodyMatch = content.toLowerCase().includes(query);

  switch (scope) {
    case "tags":
      return tagMatch;
    case "titles":
      return titleMatch;
    case "content":
      return bodyMatch || summaryMatch;
    case "all":
    default:
      return titleMatch || summaryMatch || tagMatch || bodyMatch;
  }
}

export function searchWikiPages(
  rootDir: string,
  query: string,
  scope: WikiSearchScope = "all",
): WikiSearchOutput {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (!existsSync(wikiDir)) {
    return { results: [], total: 0 };
  }

  const normalized = normalizeQuery(query);
  if (!normalized) return { results: [], total: 0 };

  const results: WikiSearchResult[] = [];
  for (const relPath of listWikiPageRelPaths(wikiDir)) {
    const content = readFileSync(join(wikiDir, relPath), "utf8");
    const page = loadPageMetadata(wikiDir, relPath);
    if (pageMatches(page, content, normalized, scope)) {
      results.push(page);
    }
  }

  results.sort((a, b) => a.title.localeCompare(b.title));
  return { results, total: results.length };
}

export function formatWikiSearchResult(output: WikiSearchOutput): string {
  if (output.total === 0) return "No wiki pages matched the query.";
  const lines = [`Found ${output.total} page(s):`, ""];
  for (const page of output.results) {
    lines.push(`- **${page.title}** (\`${page.relPath}\`)`);
    if (page.summary) lines.push(`  Summary: ${page.summary}`);
    if (page.tags.length > 0) lines.push(`  Tags: ${page.tags.join(", ")}`);
    if (page.category) lines.push(`  Category: ${page.category}`);
    if (page.connections.length > 0) {
      const connList = page.connections.map((c) => c.path).join(", ");
      lines.push(`  Connections: ${connList}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function buildWikiSearchTool(rootDir: string): ToolDefinition[] {
  return [
    defineTool({
      name: "wiki_search",
      label: "Search wiki",
      description:
        "Search the user's personal wiki for relevant pages. Returns metadata only (path, title, summary, tags, category, connections) — never page bodies. Read matched pages with read before answering from them.",
      parameters: Type.Object({
        query: Type.String({ description: "Keywords to search for" }),
        scope: Type.Optional(
          Type.Union([
            Type.Literal("tags"),
            Type.Literal("titles"),
            Type.Literal("content"),
            Type.Literal("all"),
          ], { description: "Where to search (default: all)" }),
        ),
      }),
      async execute(_callId, args) {
        const output = searchWikiPages(rootDir, args.query, args.scope ?? "all");
        return {
          content: [{ type: "text", text: formatWikiSearchResult(output) }],
          details: output as unknown as Record<string, unknown>,
        };
      },
    }),
  ];
}

/** Invoke wiki_search and return text + details (tests + BDD). */
export async function executeWikiSearchTool(
  tools: ToolDefinition[],
  args: { query: string; scope?: WikiSearchScope },
): Promise<{ text: string; details: WikiSearchOutput }> {
  const tool = tools.find((t) => t.name === "wiki_search");
  if (!tool) throw new Error("wiki_search tool not registered");
  const result = await tool.execute(
    "test-call",
    args,
    new AbortController().signal,
    () => {},
    {} as never,
  );
  const text = result.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return { text, details: result.details as unknown as WikiSearchOutput };
}
