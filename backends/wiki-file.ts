// backends/wiki-file.ts — FR-WIKI-01/03/09: lightweight wiki capture from conversation.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { toIsoDay } from "../shared/dates";
import { WIKI_DIR } from "../shared/brain-paths";
import { buddyPath, wikiIndexPath, wikiMetaLogPath } from "./brain-paths";
import { slugifyTitle, validateWikiSummary, validateWikiTags, type WikiLanguage } from "./wiki-format";
import { runPostWriteWikiHealth } from "./wiki-check";
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

export interface WikiConnectionInput {
  path: string;
  description: string;
}

export interface WikiFileInput {
  title: string;
  summary: string;
  key_points: string[];
  tags: string[];
  category: string;
  connections: WikiConnectionInput[];
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

export function normalizeConnectionPath(href: string, pageWikiRel: string): string {
  const hashIndex = href.indexOf("#");
  const pathPart = (hashIndex === -1 ? href : href.slice(0, hashIndex)).trim();
  const fragment = hashIndex === -1 ? "" : href.slice(hashIndex);

  if (!pathPart || /^https?:/i.test(pathPart)) return href;
  if (pathPart.startsWith("../") || pathPart.startsWith("./")) return href;
  if (!pathPart.includes("/")) return href;

  let targetWikiRel = pathPart.replace(/^user\/wiki\//, "");
  return `${wikiLinkBetween(pageWikiRel, targetWikiRel)}${fragment}`;
}

export function normalizeConnectionPaths(
  connections: WikiConnectionInput[],
  pageWikiRel: string,
): WikiConnectionInput[] {
  return connections.map((conn) => ({
    ...conn,
    path: normalizeConnectionPath(conn.path, pageWikiRel),
  }));
}

export function fileWikiConcept(
  rootDir: string,
  input: WikiFileInput,
  language?: WikiLanguage,
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
  let normalizedConnections = input.connections;

  if (match?.matchType === "title") {
    wikiRelPath = match.relPath;
    normalizedConnections = normalizeConnectionPaths(input.connections, wikiRelPath);
    const enrichInput: WikiEnrichInput = {
      keyPoints: input.key_points,
      examples: input.examples,
      tags: input.tags,
      sources: input.sources,
      connections: normalizedConnections,
      updated: today,
    };
    const result = enrichPage(rootDir, wikiRelPath, enrichInput, language);
    if (result.action === "too-large") {
      wikiRelPath = createNewLinkedPage(rootDir, input, today, match.relPath, language);
      normalizedConnections = normalizeConnectionPaths(input.connections, wikiRelPath);
      filed.push({ action: "created", page: wikiRelPath, category: slugCategory(input.category) });
    } else {
      filed.push({ action: "enriched", page: wikiRelPath, category: wikiRelPath.split("/")[0] ?? "" });
    }
  } else {
    const { wikiRelPath: targetPath } = resolveWikiPagePath(rootDir, input.category, input.title);
    normalizedConnections = normalizeConnectionPaths(input.connections, targetPath);
    wikiRelPath = createWikiPage(
      rootDir,
      {
        title: input.title,
        summary: input.summary,
        tags: input.tags,
        sources: input.sources,
        created: today,
        updated: today,
        keyPoints: input.key_points,
        examples: input.examples,
        connections: normalizedConnections,
        category: input.category,
      },
      language,
    );
    filed.push({ action: "created", page: wikiRelPath, category: slugCategory(input.category) });
  }

  connectionsAdded += addBacklinks(rootDir, wikiRelPath, normalizedConnections, input.title, language);
  regenerateWikiIndex(rootDir, now, language);
  runPostWriteWikiHealth(rootDir, language, now);

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
  language?: WikiLanguage,
): string {
  const altTitle = `${input.title} (continued)`;
  const { wikiRelPath: newRelPath } = resolveWikiPagePath(rootDir, input.category, altTitle);
  const seeAlsoPath = wikiLinkBetween(newRelPath, existingRelPath);
  const connections = [
    ...normalizeConnectionPaths(input.connections, newRelPath),
    { path: seeAlsoPath, description: "see also — related page was too large to enrich" },
  ];
  return createWikiPage(
    rootDir,
    {
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
    },
    language,
  );
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

export function buildWikiFileTool(rootDir: string, language?: WikiLanguage): ToolDefinition[] {
  const lang = language ?? "en";
  // Content language is injected into the tool description so the LLM writes
  // prose (title, summary, key points, examples) in the instance language.
  // This works for conversational captures (FR-WIKI-09) where the agent fills
  // fields directly. Document ingest (FR-WIKI-02) will need the same signal
  // threaded into the child-session extraction prompt when implemented.
  const langLabel = lang === "es" ? "Spanish" : "English";
  return [
    defineTool({
      name: "wiki_file",
      label: "File to wiki",
      description:
        `File user knowledge into the personal wiki as an interconnected markdown page. Write all content (title, summary, key points, examples) in ${langLabel}. Tags remain lowercase English slugs. Provide structured fields directly — title, summary, key points, tags, category, and connections. Use for ideas, concepts, and reference notes the user wants to keep.`,
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
        const output = fileWikiConcept(rootDir, args as WikiFileInput, language);
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
