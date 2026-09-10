// backends/closure-prompt.ts — FR-TOPIC-03 interactive closure prompt.

/** System-framed prompt for the wrap-up turn before a topic transition. */
export function buildClosurePrompt(): string {
  return (
    "[System: the user is about to switch topics. Before moving on, " +
    "wrap up the current conversation: (1) summarize what was discussed, " +
    "(2) list any decisions made, (3) list any pending items or open questions, " +
    "(4) suggest a concrete next action. Be concise — this is a transition aid, " +
    "not a report. After your response, the session will close automatically.]"
  );
}
