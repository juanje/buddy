// backends/orientation-prompt.ts — silent recap prompt for FR-ORIENT-03.

export function buildOneLinerPrompt(): string {
  return (
    "[System: the user just opened the app for the first time today. " +
    "Based on the session logs in your context, write a single sentence " +
    "summarizing what you worked on in the last session. " +
    "Reply in the user's language. One sentence only, no preamble.]"
  );
}
