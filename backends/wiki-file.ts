// backends/wiki-file.ts — FR-WIKI-01/03/09: lightweight wiki capture from conversation.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { toIsoDay } from "../shared/dates";
import { WIKI_DIR } from "../shared/brain-paths";
import { buddyPath, wikiIndexPath, wikiMetaLogPath } from "./brain-paths";
import { slugifyTitle, validateWikiSummary, validateWikiTags } from "./wiki-format";
import { regenerateWikiIndex } from "./wiki-index";
import {
  addBacklinks,
  appendWikiLog,
  createWikiPage,
  enrichPage,
  findMatchingPage,
  resolveWikiPagePath,
  wikiLinkBetween,
  type WikiEnrichInput,
} from "./wiki-reconcile";

export interface WikiFileInput {
  title: string;
  summary: string;
  key_points: string[];
  tags: string[];
  category: string;
  connections: Array<{ path: string; description: string }>;
  examples?: string[];
  sources?: string[];
}

export interface WikiFileResult {
  action: "created" | "enriched";
  page: string;
  category: string;
}

export interface WikiFileOutput {
  filed: WikiFileResult[];
  connections_added: number;
  summary: string;
}

export function bootstrapWiki(rootDir: string): void {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (existsSync(wikiDir)) return;

  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(wikiIndexPath(rootDir), "# Wiki\n\n", "utf8");
  mkdirSync(buddyPath(rootDir, `${WIKI_DIR}/.meta`), { recursive: true });
  writeFileSync(wikiMetaLogPath(rootDir), "# Wiki log\n\n", "utf8");
}

export function fileWikiConcept(
  rootDir: string,
  input: WikiFileInput,
  now: Date = new Date(),
): WikiFileOutput {
  bootstrapWiki(rootDir);

  const tagError = validateWikiTags(input.tags);
  if (tagError) throw new Error(tagError);
  const summaryError = validateWikiSummary(input.summary);
  if (summaryError) throw new Error(summaryError);

  const today = toIsoDay(now);
  const match = findMatchingPage(rootDir, input.title, input.tags);
  const filed: WikiFileResult[] = [];
  let connectionsAdded = 0;
  let wikiRelPath: string;

  const enrichInput: WikiEnrichInput = {
    keyPoints: input.key_points,
    examples: input.examples,
    tags: input.tags,
    sources: input.sources,
    connections: input.connections,
    updated: today,
  };

  if (match?.matchType === "title") {
    const result = enrichPage(rootDir, match.relPath, enrichInput);
    if (result.action === "too-large") {
      wikiRelPath = createNewLinkedPage(rootDir, input, today, match.relPath);
      filed.push({ action: "created", page: wikiRelPath, category: slugCategory(input.category) });
    } else {
      wikiRelPath = match.relPath;
      filed.push({ action: "enriched", page: wikiRelPath, category: wikiRelPath.split("/")[0] ?? "" });
    }
  } else {
    wikiRelPath = createWikiPage(rootDir, {
      title: input.title,
      summary: input.summary,
      tags: input.tags,
      sources: input.sources,
      created: today,
      updated: today,
      keyPoints: input.key_points,
      examples: input.examples,
      connections: input.connections,
      category: input.category,
    });
    filed.push({ action: "created", page: wikiRelPath, category: slugCategory(input.category) });
  }

  connectionsAdded += addBacklinks(rootDir, wikiRelPath, input.connections, input.title);
  regenerateWikiIndex(rootDir, now);

  const logEntry = `- **${filed[0].action}:** ${wikiRelPath} — ${input.summary}`;
  appendWikiLog(rootDir, logEntry, now);

  return {
    filed,
    connections_added: connectionsAdded,
    summary: `${filed[0].action} ${input.title} at user/wiki/${wikiRelPath}`,
  };
}

function slugCategory(category: string): string {
  return slugifyTitle(category);
}

function createNewLinkedPage(
  rootDir: string,
  input: WikiFileInput,
  today: string,
  existingRelPath: string,
): string {
  const altTitle = `${input.title} (continued)`;
  const { wikiRelPath: newRelPath } = resolveWikiPagePath(rootDir, input.category, altTitle);
  const seeAlsoPath = wikiLinkBetween(newRelPath, existingRelPath);
  const connections = [
    ...input.connections,
    { path: seeAlsoPath, description: "see also — related page was too large to enrich" },
  ];
  return createWikiPage(rootDir, {
    title: altTitle,
    summary: input.summary,
    tags: input.tags,
    sources: input.sources,
    created: today,
    updated: today,
    keyPoints: input.key_points,
    examples: input.examples,
    connections,
    category: input.category,
  });
}

export function formatWikiFileResult(output: WikiFileOutput): string {
  const lines = [output.summary];
  if (output.connections_added > 0) {
    lines.push(`Added ${output.connections_added} backlink(s).`);
  }
  for (const item of output.filed) {
    lines.push(`- ${item.action}: user/wiki/${item.page}`);
  }
  return lines.join("\n");
}

export function buildWikiFileTool(rootDir: string): ToolDefinition[] {
  return [
    defineTool({
      name: "wiki_file",
      label: "File to wiki",
      description:
        "File user knowledge into the personal wiki as an interconnected markdown page. Provide structured fields directly — title, summary, key points, tags, category, and connections. Use for ideas, concepts, and reference notes the user wants to keep.",
      parameters: Type.Object({
        title: Type.String({ description: "Page title" }),
        summary: Type.String({ description: "One-line summary for index and search" }),
        key_points: Type.Array(Type.String(), { description: "Key points to capture" }),
        tags: Type.Array(Type.String(), { description: "Lowercase slug tags" }),
        category: Type.String({ description: "Category slug or name (creates subdirectory if needed)" }),
        connections: Type.Array(
          Type.Object({
            path: Type.String({ description: "Relative path to related wiki page" }),
            description: Type.String({ description: "Why they connect" }),
          }),
          { description: "Links to related pages" },
        ),
        examples: Type.Optional(Type.Array(Type.String())),
        sources: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_callId, args) {
        const output = fileWikiConcept(rootDir, args as WikiFileInput);
        return {
          content: [{ type: "text", text: formatWikiFileResult(output) }],
          details: output as unknown as Record<string, unknown>,
        };
      },
    }),
  ];
}

/** Invoke wiki_file and return text + details (tests + BDD). */
export async function executeWikiFileTool(
  tools: ToolDefinition[],
  args: WikiFileInput,
): Promise<{ text: string; details: WikiFileOutput }> {
  const tool = tools.find((t) => t.name === "wiki_file");
  if (!tool) throw new Error("wiki_file tool not registered");
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
  return { text, details: result.details as unknown as WikiFileOutput };
}
