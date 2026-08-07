# Skill: Process conversation

## Procedure

### 1. Review the conversation

Read the current or most recent conversation. Extract only what has value:
- Decisions and their reasoning (the "why" matters most)
- Tasks captured or mentioned
- Ideas worth remembering
- Context that helps future-you understand what happened
- Lessons learned
- Open threads (unresolved)

### 2. Write the log entry

Produce a `## Session HH:MM–HH:MM` block for today's log **in English**, regardless of the conversation language. The log is operational documentation, not user-facing content.

Include ONLY sections that have content — omit empty sections entirely. Available sections:

- **Decisions** — what was decided and why
- **Tasks captured** — actionable items routed to inbox or projects
- **Information stored** — reference material saved to brain files, no action required
- **Context** — situational notes, what prompted the session
- **Lessons** — patterns discovered, things learned
- **Open threads** — unresolved items to revisit

Keep it dense. A trivial session gets 2-3 lines. A rich session gets a paragraph per section. Never pad with "None" entries or filler.

### 3. Verify captures

*Requires tools — skip this step when told you have none.*

Ensure actionable items landed in the right place:
- Tasks → `user/` (inbox or project)
- Ideas → `agent_brain/ideas/`
- Decisions → `agent_brain/projects/` or `agent_brain/concepts/`

### 4. Detect observations and preference signals

Only if genuine signals emerged — skip otherwise:
- **Rule candidate:** User correction or explicit preference → note for AGENTS.md. Example: user says "write my files in Spanish" → rule candidate: "Content in user/ should be in the user's preferred language."
- **Skill candidate:** Repeatable multi-step workflow emerging.
- **Concept candidate:** A lesson that generalizes beyond today.
- **Preference change:** The user revealed a new preference, changed an existing one, corrected stored information, or mentioned a personal fact not yet in USER.md. Examples: pausing an activity, changing work schedule, correcting a language preference, mentioning a new interest or dropping an old one.

Write to `agent_brain/observations.md` (increment count if pattern already exists).

*When you have no tools:* emit an `### Observations` section instead and the
worker files it. Omit the section entirely when nothing emerged — an empty
heading is not an observation.

## Quality rules

- **Synthesize, don't transcribe.** Log what was decided/learned, not what was said. "User asked about memory; explained three-layer model" — not a transcript of the explanation.
- **Be specific.** "Discussed tasks" is useless. "Decided to use GTD inbox with @context lists" is useful.
- **Don't inflate.** Short sessions get short logs. No filler, no ceremony.
- **Future reader test.** Someone without today's context should understand what happened and why.
- **Write about the conversation, never about this procedure.** These instructions are not something the session taught you. A log entry noting "the importance of the future reader test" or "used the process-conversation skill" is the machinery describing itself, in a file that is injected into every future session.
