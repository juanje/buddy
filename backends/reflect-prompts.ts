// backends/reflect-prompts.ts — User message templates for reflect child (FR-REFLECT-02/03).
// The fork carries full conversation context; these prompts request structured output only.

export const REFLECT_USER_PROMPT = `Reflect on this session and produce a structured summary with these sections:

### Decisions
Decisions made during this session (or "None" if none).

### Tasks captured
What was captured and where it was filed (or "None" if nothing actionable).

### Ideas
Ideas discussed, whether filed or not (or "None").

### Context
What was the session about — topics discussed, tasks worked on, state of things.

### Lessons
Patterns, insights, or corrections learned (or "None").

### Open threads
Things left unresolved, pending, or to follow up on (or "None").

### System observations
Skill, rule, concept, or structure candidates detected (or "None").

If today's daily log already contains ## Checkpoint entries from this session, emphasize activity since the last checkpoint while still producing a complete session summary.

Be concise. Capture substance, not mechanics. Write in English.`;

export const CHECKPOINT_USER_PROMPT = `Briefly encode the recent segment of this session before context compaction:

### Context
What was happening in this segment of the session.

### Notes
Anything worth remembering from this segment.

Be very concise — this is a checkpoint, not a full reflect. Write in English.`;

export const CRASH_CATCHUP_USER_PROMPT_PREFIX =
  "Process this session skeleton into a reflect. The skeleton is the only available context — produce the best summary you can:\n\n";
