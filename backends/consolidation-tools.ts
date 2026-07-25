// backends/consolidation-tools.ts — FR-CONSOL-07: consolidation-only custom tools.

import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { relocateBrainFile, RelocateBrainFileError } from "./consolidation-mechanics";

export function buildConsolidationTools(rootDir: string): ToolDefinition[] {
  return [
    defineTool({
      name: "relocate_brain_file",
      label: "Relocate brain file",
      description:
        "Move a file within agent_brain/ to a new path (git mv + link rewrite). Use during monthly grouping to organize related files into subdirectories.",
      parameters: Type.Object({
        source: Type.String({
          description: "Current path relative to AB root (must start with agent_brain/)",
        }),
        destination: Type.String({
          description: "Target path relative to AB root (must start with agent_brain/)",
        }),
      }),
      async execute(_callId, args) {
        try {
          const result = await relocateBrainFile(rootDir, args.source, args.destination);
          const rewritten =
            result.rewrittenLinks.length > 0
              ? result.rewrittenLinks.join(", ")
              : "(none)";
          return {
            content: [
              {
                type: "text",
                text: `Moved ${args.source} → ${args.destination}. Links rewritten in: ${rewritten}`,
              },
            ],
            details: result,
          };
        } catch (error) {
          const message =
            error instanceof RelocateBrainFileError
              ? error.message
              : error instanceof Error
                ? error.message
                : String(error);
          throw new Error(message);
        }
      },
    }),
  ];
}

export function consolidationToolNames(tools: ToolDefinition[]): string[] {
  return tools.map((tool) => tool.name);
}

/** Invoke a consolidation tool and return its text payload (tests + BDD). */
export async function executeConsolidationTool(
  tools: ToolDefinition[],
  name: string,
  args: Record<string, string>,
): Promise<string> {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Consolidation tool not found: ${name}`);

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
