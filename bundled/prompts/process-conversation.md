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

Also extract **concrete facts**: names of people mentioned, specific dates,
amounts, document names, reference numbers, and statuses. Concrete facts feed
the journal and brain files — if they are lost here, they are lost everywhere.

### 2. Write the log entry

Produce a `## Session HH:MM–HH:MM` block for today's log **in English**, regardless of the conversation language. The log is operational documentation, not user-facing content.

Include ONLY sections that have content — omit empty sections entirely. Available sections:

- **Decisions** — what was decided, why (alternatives considered, trade-offs, what tipped the balance), and the context that made the decision necessary. A decision without its reasoning is incomplete — it will need to be re-derived.
- **Tasks captured** — actionable items routed via `tasks()` or projects
- **Information stored** — specific facts written to brain files (names, dates, numbers, statuses), not vague summaries. No action required.
- **Context** — situational notes with specific details: names, places, dates, and what was said — not just topic labels
- **Lessons** — patterns discovered, things learned
- **Open threads** — unresolved items to revisit

Keep it dense. A trivial session gets 2-3 lines. A rich session gets a paragraph per section. Never pad with "None" entries or filler.

### 3. Verify captures

*Requires tools — skip this step when told you have none.*

Ensure items landed in the right place by classification type:
- Actions → captured via `tasks()` tool, each with a concrete next step
- Projects (multi-step outcomes) → `user/projects/` file + first task
- Areas of focus → `agent_brain/projects/area/` or `user/workspaces/area/`
- Maturing items → `agent_brain/deferred.md` with revisit date
- Context → no explicit file (reflect captured it in the log)
- Ideas → `agent_brain/ideas/`
- Decisions → `agent_brain/projects/` or `agent_brain/concepts/`

### 4. Detect observations and preference signals

Review the conversation looking for signals that the system itself should
evolve, or that new knowledge is emerging. Only record genuine observations.

**Skill candidates — a reusable procedure is emerging:**
- The user asked for a multi-step procedure not covered by an existing skill.
- You performed a sequence of 3+ steps that could be reused in similar situations.
- The user said something like "do what you did last time with X."
- NOT a candidate: one-time instructions ("format this as a table"), or
  procedures too specific to reuse.

**Rule candidates — a behavioral correction or preference:**

Two paths depending on how the signal was detected:

- **Explicit user correction** (the user directly told you to change behavior:
  "don't do X", "always do Y", or pointed out a mistake): **fast-track**. Note
  it for AGENTS.md with the reasoning. Example: user says "write my files in
  Spanish" → **Rule candidate:** "Content in user/ should be in the user's
  preferred language."
- **Inferred** pattern (an assumption that turned out wrong, a preference
  expressed indirectly, a principle you violated and self-corrected): log it
  as an observation. Consolidation acts when seen 2+ times.
- NOT a candidate: preferences already captured in USER.md, or one-off
  requests for this conversation only.

Every rule must include its reasoning — what it prevents or enables.
Format: `[rule]. [why].`

**Concept candidates — new knowledge worth retaining:**
- A lesson or pattern that could apply beyond the specific situation discussed.
- A principle or heuristic the user articulated that generalizes.
- A concept must add decision-making power beyond its parent concept.
- NOT a candidate: content-specific decisions (which tech to use for project X)
  — those go in project files, not as observations.

**Structure candidates — information doesn't fit the current layout:**
- A file was created in a directory that doesn't quite fit.
- The user mentioned a category of information that has no home yet.
- Multiple files of a similar type exist in a generic directory.

**Staleness signals — memory was wrong:**
- You used information from memory that turned out to be outdated. Note which
  file was stale.

**Preference change:** The user revealed a new preference, changed an existing
one, corrected stored information, or mentioned a personal fact not yet in
USER.md. Look for both explicit signals ("I stopped doing X") and implicit ones
(wording choices, corrections, repeated behaviors mentioned in passing).
Examples: pausing an activity, changing work schedule, correcting a language
preference, mentioning a new interest or dropping an old one.

Write to `agent_brain/observations.md` (increment count if pattern already exists).

*When you have no tools:* emit an `### Observations` section instead and the
worker files it. Omit the section entirely when nothing emerged — an empty
heading is not an observation.

## Quality rules

- **Synthesize, don't transcribe.** Log what was decided/learned, not what was said. "User asked about memory; explained three-layer model" — not a transcript of the explanation.
- **Be specific.** "Discussed tasks" is useless. "Decided to use GTD inbox with @context lists" is useful.
- **Preserve concrete facts.** Names, dates, amounts, document references, statuses, and what people said are the raw material for memory. "Discussed the apartment search" is a topic label; "visited two apartments in Triana; the second one (Calle Lomo, 3rd floor) is within budget; landlord expects answer by Friday" is usable context.
- **Don't inflate.** Short sessions get short logs. No filler, no ceremony.
- **Future reader test.** Someone without today's context should understand what happened and why.
- **Write about the conversation, never about this procedure.** These instructions are not something the session taught you. A log entry noting "the importance of the future reader test" or "used the process-conversation skill" is the machinery describing itself, in a file that is injected into every future session.
