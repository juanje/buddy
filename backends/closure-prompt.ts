// backends/closure-prompt.ts — FR-TOPIC-03/06 interactive closure prompt.

/** System-framed prompt for the wrap-up turn before a topic transition. */
export function buildClosurePrompt(): string {
  return (
    "[System: the user is about to switch topics. Before moving on, " +
    "wrap up the current conversation: (1) summarize what was discussed, " +
    "(2) list any decisions made, (3) list any pending items or open questions, " +
    "(4) suggest a concrete next action. " +
    "If you identified pending items or concrete next actions, ask the user " +
    "whether you should capture them as tasks — and if they agree, call " +
    "tasks(action='add', ...) for each one. Do not create tasks without asking first. " +
    "Be concise — this is a transition aid, " +
    "not a report. If the user has questions or wants to discuss anything before " +
    "moving on, invite them to respond — they will close the session when ready.]"
  );
}
