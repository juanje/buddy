import type { AgentEvent } from "./api";

export function extractToolInfo(event: AgentEvent): { name: string; path?: string } | null {
  const name =
    (event.toolName as string | undefined) ??
    (event.toolCall as { name?: string } | undefined)?.name;
  if (!name) return null;
  const args =
    (event.args as { path?: string } | undefined) ??
    (event.toolCall as { args?: { path?: string } } | undefined)?.args;
  const path = typeof args?.path === "string" ? args.path : undefined;
  return { name, path };
}
