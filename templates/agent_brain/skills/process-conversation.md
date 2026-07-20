---
last_accessed:
access_count: 0
created:
---

# Skill: Process conversation

## When to use

Triggered by the user ("reflect", "save the conversation") or by the app
after a session ends. Never run this skill autonomously — the app handles
session logging on shutdown.

## Procedure

### 1. Review the conversation

Read the current or most recent conversation. Identify:
- Decisions and their reasoning
- Tasks mentioned or captured
- Ideas discussed
- Meeting context or situational notes
- Lessons learned or patterns discovered
- Open threads (discussed but unresolved)

### 2. Update today's log

Open `logs/YYYY-MM-DD.md` (today's date). If it exists, append new content
under the existing sections (avoid duplicating information already logged earlier
in the day). When appending a **new session** on a day that already has a log,
start with a session header so multiple sessions are distinguishable:

```markdown
## Session HH:MM–HH:MM

### Decisions
- ...

### Tasks captured
- ...
```

If the file doesn't exist, create it with this structure:

```markdown
---
date: YYYY-MM-DD
last_updated: YYYY-MM-DDTHH:MM
---

# Log — YYYY-MM-DD

## Decisions
- [Decision and reasoning, with enough context for future reference]

## Tasks captured
- [What was captured and where it was filed]

## Ideas
- [Ideas discussed, whether filed or not]

## Context
- [Meetings, conversations, situational context]

## Lessons
- [Patterns discovered, errors and fixes, things learned]

## Open threads
- [Discussed but unresolved — to pick up later]
```

Always update the `last_updated` timestamp in the frontmatter.

### 3. Verify captures

Check that everything actionable from the conversation has been properly captured:
- Action items, tasks → `user/` (appropriate file or structure)
- Concrete improvement ideas → `user/` or `agent_brain/ideas/`
- Unformed ideas / project concepts / draft proposals → `agent_brain/ideas/`
- Decisions → `agent_brain/projects/` or `agent_brain/concepts/`
- Lessons → `agent_brain/concepts/`

When you add information that **extends, clarifies, or exemplifies** something that already
exists elsewhere (concept, project, article, log decision), **link it explicitly**:

- With a short explanation of **what is on the other side** and **why to go there**:

  ```markdown
  > Related: [Understanding complexity](agent_brain/concepts/understanding-complexity.md)
  > Deeper explanation of the formal framework behind today's example.
  ```

Every link must be **functional**: it serves the reader of the file it's in
and has clear intent. Don't add links to maintain bidirectional relationships.
Don't cap the number — add every link that genuinely helps the reader
navigate to useful context. The goal is that future you (and the agent) can
decide whether to follow a link without opening it first.

If anything was missed (capture or link), add it now.

### 4. Patch stale active context

*The app may skip this step in fully autonomous mode — follow any mode
instructions in your context.*

Scan the **Active context → Right now** section in `AGENTS.md` and the hot files listed under **Active context → Files**. For each item, ask: did something in this session change it?

Patch immediately (don't wait for consolidation) if:
- A near-term date or time changed (rescheduled meeting, moved appointment)
- A task or status in the current week flipped (completed, cancelled, blocked)
- Information that would cause a concrete mistake in the *next* session if left stale

Do **not** patch during reflect:
- Long-term project context — already in `projects/`, consolidation handles promotion
- Completed items that just need archiving — consolidation sweeps those
- Wording improvements or structural reorganization — consolidation owns those

If you patch, note it briefly in the log under a **Patches** line in the relevant section (Decisions or Context).

### 5. Detect observations

Review the conversation looking for signals that the system itself should
evolve, or that new knowledge is emerging. This is the detection step — flag
what *might* matter. The consolidation cycle will decide what to act on.

Look for the following categories. For each, decide: is this a real signal or
noise? Only record genuine observations.

**Skill candidates — a reusable procedure is emerging:**
- The user asked for a multi-step procedure not covered by an existing skill.
- You performed a sequence of 3+ steps that could be reused in similar
  situations.
- The user said something like "do what you did last time with X" — implies
  a repeatable pattern.
- NOT a candidate: one-time instructions ("format this as a table"), or
  procedures too specific to reuse.

**Rule candidates — a behavioral correction or preference:**

Two paths depending on how the signal was detected:

- **Explicit user correction** (the user directly told you to change behavior:
  "don't do X", "always do Y", or pointed out a mistake): **fast-track**.
  Apply the rule immediately — add it to AGENTS.md Rules and log it as
  resolved in the observation journal. Don't wait for the 2+ threshold — a
  direct correction is a strong signal. Confirm briefly with the user:
  "added rule: [summary]".

- **Inferred rule candidate** (you noticed a pattern: an assumption that
  turned out wrong, a preference expressed indirectly, a SOUL.md principle
  you violated and self-corrected): log it in the observation journal as
  usual. Consolidation acts on it when seen 2+ times.

- NOT a candidate: preferences already captured in USER.md, or one-off
  requests for this conversation only.

**Quality criteria for rule formulation:**
Every rule must include its reasoning — the context in which it applies and what
it prevents or enables. Format: `[rule]. [why].` Before proposing a rule,
evaluate where it sits on the spectrum:
- Universal trait that describes who the agent IS → propose for SOUL.md Character.
- Contextual operational rule → AGENTS.md Rules, with WHY.
- One-time correction → log only, don't create a rule.

**Concept candidates — new knowledge worth retaining:**
- A lesson or pattern that could apply beyond the specific situation discussed.
- A principle or heuristic the user articulated that generalizes.
- A connection between today's topic and something previously discussed or
  captured in `agent_brain/`.
- NOT a candidate: content-specific decisions (which tech to use for
  project X) — those go in project files, not as observations.

**Structure candidates — information doesn't fit the current layout:**
- A file was created in a directory that doesn't quite fit (e.g., a team
  reference saved as a "concept").
- The user mentioned a category of information that has no home yet.
- Multiple files of a similar type exist in a generic directory.

**Staleness signals — memory was wrong:**
- You used information from memory that turned out to be outdated. Note
  which file was stale and update it now (don't wait for consolidation).

If there are observations, write them to **both** the daily log and the
observation journal:

**In the log** (`logs/YYYY-MM-DD.md`), append:

```markdown
## System observations
- **Skill candidate:** [description of repeated procedure]
- **Rule candidate:** [proposed rule and why]
- **Concept candidate:** [pattern or connection detected]
- **Structure candidate:** [proposed directory and what would go there]
- **Stale data fixed:** [file updated and what changed]
```

**In the journal** (`agent_brain/observations.md`), add each observation
under its category. If an existing entry describes the same pattern, don't
duplicate it — increment its count and add the new date:

```markdown
- **YYYY-MM-DD:** [description] (seen: 1)
  - YYYY-MM-DD: seen again in [context] (seen: 2)
```

If there are no observations, skip this section — don't force it.

## Quality criteria

- **Be specific.** "Discussed CI/CD" is useless. "Decided to migrate from Jenkins to
  Tekton because of X" is useful.
- **Focus on reasoning.** Decisions and their "why" are the most valuable content.
- **Don't inflate.** If the conversation was trivial, the log can be minimal.
- **Think of future you.** The log is for someone without today's context who needs
  to understand when and why something was decided.
- **Append, don't overwrite.** If the log already has content from an earlier
  processing pass, add new information without duplicating.
