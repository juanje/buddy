// backends/tool-invoke.ts — run a registered Pi tool by name (tests + BDD).

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/** Execute the named tool and return its joined text blocks plus its raw details. */
export async function invokeTextTool(
  tools: ToolDefinition[],
  name: string,
  args: unknown,
): Promise<{ text: string; details: unknown }> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`${name} tool not registered`);
  const result = await tool.execute(
    "test-call",
    args as never,
    new AbortController().signal,
    () => {},
    {} as never,
  );
  const text = result.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return { text, details: result.details };
}
