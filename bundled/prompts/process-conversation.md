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

Produce a `## Session HH:MM–HH:MM` block for today's log. Include ONLY sections that have content — omit empty sections entirely. Available sections:

- **Decisions** — what was decided and why
- **Tasks captured** — what went to inbox/projects
- **Context** — situational notes, what prompted the session
- **Lessons** — patterns discovered, things learned
- **Open threads** — unresolved items to revisit

Keep it dense. A trivial session gets 2-3 lines. A rich session gets a paragraph per section. Never pad with "None" entries or filler.

### 3. Verify captures

Ensure actionable items landed in the right place:
- Tasks → `user/` (inbox or project)
- Ideas → `agent_brain/ideas/`
- Decisions → `agent_brain/projects/` or `agent_brain/concepts/`

### 4. Detect observations

Only if genuine signals emerged — skip otherwise:
- **Rule candidate:** User correction or explicit preference → note for AGENTS.md.
- **Skill candidate:** Repeatable multi-step workflow emerging.
- **Concept candidate:** A lesson that generalizes beyond today.

Write to `agent_brain/observations.md` (increment count if pattern already exists).

## Quality rules

- **Synthesize, don't transcribe.** Log what was decided/learned, not what was said. "User asked about memory; explained three-layer model" — not a transcript of the explanation.
- **Be specific.** "Discussed tasks" is useless. "Decided to use GTD inbox with @context lists" is useful.
- **Don't inflate.** Short sessions get short logs. No filler, no ceremony.
- **Future reader test.** Someone without today's context should understand what happened and why.
