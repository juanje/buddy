// backends/show-file-tool.ts — FR-CHAT-17: the agent opens a file in the
// viewer.
//
// "Muéstrame mi perfil" means *see the file*. Answering with a link is correct
// only if you already know that a link is an offer to click, which is knowledge
// about how Buddy works rather than about your own notes. This tool lets the
// agent do the opening.
//
// It adds no reach. The file is one the agent could already read, shown to the
// user who owns it, and the path goes through the same check a clicked link
// does (FR-CHAT-11, NFR-SEC-09) — including the filesystem question about
// symlinks, which the spelling of a path cannot answer.

import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { resolveViewableFile, ViewableFileError } from "./viewable-file";

export interface ShowFileToolOptions {
  rootDir: string;
  /** Push the open to the frontend (`FrontendAPI.onShowFile`). */
  showFile: (relPath: string) => void;
}

export function buildShowFileTools(options: ShowFileToolOptions): ToolDefinition[] {
  return [
    defineTool({
      name: "show_file",
      label: "Show file",
      description:
        "Open a file in the user's viewer panel so they can read it, without them having to click anything. " +
        "Use it when the user asks to see a file or the contents of something you keep for them. " +
        "Works for .md and .txt files under agent_brain/, user/, downloads/ and logs/.",
      parameters: Type.Object({
        path: Type.String({
          description: "Path to the file to show, relative to the buddy directory",
        }),
      }),
      async execute(_callId, args) {
        // A refusal propagates as a thrown error, which Pi hands back to the
        // agent as the tool result. `ViewableFileError` messages are written to
        // be repeated to the user, so nothing here reshapes them.
        const { relPath } = resolveViewableFile(options.rootDir, args.path);
        options.showFile(relPath);
        return {
          content: [{ type: "text" as const, text: `Opened ${relPath} in the user's viewer.` }],
          details: { path: relPath },
        };
      },
    }),
  ];
}

/**
 * Run one of the tools built above by name. Mirrors `executeFileTool` so the
 * BDD steps drive the real definitions rather than a copy of their bodies.
 */
export async function executeShowFileTool(
  tools: ToolDefinition[],
  name: string,
  args: Record<string, string>,
): Promise<string> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new ViewableFileError(`Unknown tool: ${name}`);
  const result = await tool.execute(
    "test-call",
    args,
    new AbortController().signal,
    () => {},
    {} as never,
  );
  const textBlock = result.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
