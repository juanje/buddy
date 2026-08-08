// backends/edit-recovery.ts — FR-GUARD-02: edit-failure recovery hints.

export interface EditRecoveryInstallable {
  agent: {
    afterToolCall?: unknown;
  };
}

export interface ToolResultLike {
  content: unknown;
  details?: unknown;
}

const HINT_NOT_FOUND =
  "Hint: Re-read the file and copy the anchor text exactly, including whitespace and newlines.";
const HINT_NOT_UNIQUE =
  "Hint: Include more surrounding lines in oldText to make the anchor unique.";
const HINT_NO_CHANGE =
  "Hint: The replacement is identical to the original — check your newText.";

/** Return an actionable hint for a known edit error, or null if none applies. */
export function enrichEditError(errorMessage: string): string | null {
  if (/Could not find (the exact text|edits\[\d+\])/i.test(errorMessage)) {
    return HINT_NOT_FOUND;
  }
  if (/Found \d+ occurrences/i.test(errorMessage)) {
    return HINT_NOT_UNIQUE;
  }
  if (/No changes made/i.test(errorMessage)) {
    return HINT_NO_CHANGE;
  }
  return null;
}

/** Extract plain text from a Pi tool result payload. */
export function extractToolResultText(result: ToolResultLike): string {
  const { content } = result;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object" && "text" in block) {
          return String((block as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return content == null ? "" : String(content);
}

/** Append a recovery hint to an edit error result, or return undefined if unchanged. */
export function enrichEditToolResult(result: ToolResultLike): ToolResultLike | undefined {
  const text = extractToolResultText(result);
  const hint = enrichEditError(text);
  if (!hint) return undefined;
  const enriched = text.includes(hint) ? text : `${text}\n\n${hint}`;
  return {
    ...result,
    content: [{ type: "text", text: enriched }],
  };
}

/**
 * Install edit-failure recovery on a session (FR-GUARD-02).
 *
 * Chains with existing afterToolCall hooks — same pattern as the heading and
 * Hebbian guards on the maintenance session.
 */
export function installEditRecoveryHook(session: EditRecoveryInstallable): void {
  const originalAfter = (session.agent as unknown as Record<string, unknown>).afterToolCall as
    | ((
        ctx: {
          toolCall: { name: string };
          args: unknown;
          result: ToolResultLike;
          isError: boolean;
        },
        signal?: AbortSignal,
      ) => Promise<{ content: unknown; details?: unknown; isError?: boolean } | undefined>)
    | undefined;

  (session.agent as unknown as Record<string, unknown>).afterToolCall = async (
    ctx: {
      toolCall: { name: string };
      args: unknown;
      result: ToolResultLike;
      isError: boolean;
    },
    signal?: AbortSignal,
  ) => {
    if (ctx.toolCall.name === "edit" && ctx.isError) {
      const enriched = enrichEditToolResult(ctx.result);
      if (enriched) ctx.result = enriched;
    }
    return originalAfter?.(ctx, signal);
  };
}
