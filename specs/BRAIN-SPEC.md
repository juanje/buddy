---
created: 2026-07-19
status: draft
---

# AB Brain Template — Specification

The brain template is the set of files that, when copied into a fresh directory,
produce an agent that behaves as AB. It is the most important artifact in the
project — the app is infrastructure; the template is the product.

This spec is developed in parallel with the technical implementation and
iterated through testing with the actual LLM.

## Principles

1. **What the code handles, the template does NOT instruct.** The worker manages:
   git commits, Hebbian metadata, session indexing, scheduling, date resolution,
   deferred surfacing. The template only describes behavior that requires LLM
   judgment.

2. **Tested by conversation.** Template quality is validated by talking to the
   agent and evaluating whether it behaves correctly — not by unit tests.
   Acceptance criteria are behavioral (FR-BRAIN-01 through 05 in SPEC.md).

3. **Iterative.** v1 of the template will not be perfect. Ship when FR-BRAIN-01
   through 03 pass consistently across 5+ test conversations. Refine with use.

4. **Portable.** The template must work if opened in Cursor/Claude Code with
   AGENTS.md as the workspace rule (graceful degradation). The app adds the
   worker enforcement layer; the template stands alone for basic functionality.

---

## File Inventory

| Template file | Purpose | Source (from current AB) | Adaptation needed |
|---|---|---|---|
| `AGENTS.md` | Base behavioral rules (system prompt) | `CLAUDE.md` from my-ab | Major rewrite — remove editor/hook/platform refs; remove code-enforced rules; focus on judgment-requiring behavior |
| `agent_brain/identity/SOUL.md` | Agent character + first-session flow | `agent_brain/identity/SOUL.md` from my-ab | Generalize (remove Juanje-specific); add first-session personalization section |
| `agent_brain/identity/USER.md` | User profile (placeholder) | New | Minimal placeholder that signals "new user, personalize me" |
| `agent_brain/skills/consolidation.md` | How to consolidate at each depth | Multiple skills from my-ab (process-conversation, daily-consolidation, weekly-review, monthly-maintenance) | Major rewrite — merge into one depth-parameterized skill; remove worker-handled steps (timing, git, indexing) |
| `agent_brain/observations.md` | Pattern tracking | New (empty with structure) | Define section format |
| `agent_brain/deferred.md` | Reminders/async items | New (empty) | Define parseable date format |
| `user/inbox.md` | GTD inbox | New (empty with structure) | Define sections (Capture, Next Actions) |
| `logs/index.md` | Session registry | New (empty) | Managed by code; define frontmatter schema |

---

## AGENTS.md Design

### What stays from current CLAUDE.md

- Routing rules: "user acts → user/, agent learns → agent_brain/"
- Capture-over-perfection principle
- Progressive disclosure: read index before drilling into files
- Confirmation before reorganizing user/ space
- "If you say you'll remember, write it to a file"
- Observation pipeline: note patterns, track occurrences
- Don't make unilateral decisions about priorities

### What is REMOVED (handled by code)

- "Update last_accessed / access_count" — worker does this
- "Commit regularly" — worker auto-commits
- "Update logs/index.md" — worker rebuilds at session end
- "Check deferred.md at session start" — worker surfaces in system prompt
- "Resolve night-owl dates" — worker resolves before passing to LLM
- All hook/cron/platform instructions
- Multi-editor compatibility notes
- Maintenance scheduling rules

### What is NEW (app-specific)

- "Your tools are: read, write, edit, ls, find, grep. You have no bash."
- "When you want to remember something, write it. The system commits for you."
- "The user may attach files (drag & drop). Read and discuss them when they do."
- "Identity files (SOUL.md, USER.md) — the system will ask the user to confirm
  any changes you propose to these."
- Reference to consolidation skill for depth-specific procedures

### Tone and language

Written for a capable LLM (Claude Sonnet/GPT-4o class). Concise, no
redundancy. If something is enforced by code, don't mention it — the LLM
doesn't need to know about mechanisms it can't influence.

---

## SOUL.md Design

### What stays

- Core character traits: curious, honest, direct, opinionated, self-correcting
- Warm but contained interaction style
- Capture over perfection
- Intellectual engagement (challenge assumptions when relevant)

### What changes

- Remove references to Juanje, specific users, or this project
- Add "First session behavior" section (instructions for personalizing a new user)
- Generalize language preferences (detect from user's first message)
- Remove "repository content in English" rule (app is for personal use;
  language follows user preference entirely)

### First session behavior section

```markdown
## First session behavior

If USER.md contains only placeholder content, this is a new user.
Your first priority is to learn about them — naturally, not as a form:

- Notice what language they write in. Match it from the first response.
- Within the first 2-3 exchanges, learn their name and how they want to be addressed.
- Learn what they want to use you for (tasks, ideas, journal, work, personal).
- Write what you learn to USER.md as you go — don't wait until the end.
- Be warm and welcoming but not effusive. Show that you're useful immediately
  (capture something they mention, show you remembered it).

After the first conversation, USER.md should have: name, language, primary
use case, and any preferences expressed. Everything else builds over time.
```

---

## Consolidation Skill Design

### What the skill describes (LLM's job)

- Depth 0 (reflect): Read recent conversation, extract decisions/tasks/lessons/context/open threads. Write observations.
- Depth 1 (daily): Synthesize day summary from logs. Write journal entry. Surface 2+ observations → create concepts. Propose Hebbian adjustments.
- Depth 2 (weekly): Broader synthesis. Review ideas lifecycle. Generalization pass. Link discovery.
- Depth 3 (monthly): Deep reorganization proposal. Prune unused skills. Identity evolution proposals.

### What the skill does NOT describe (worker's job)

- When to run (usage-based counters)
- Cascade ordering
- Git commits
- Session indexing
- Lock management
- Frontmatter metadata updates

---

## Observations format

```markdown
# Observations

Patterns noticed by the agent. When an observation reaches 2+ occurrences,
the consolidation process evaluates whether to promote it to a concept or skill.

## Active

### [observation title]
- **Seen:** N times
- **First:** YYYY-MM-DD
- **Last:** YYYY-MM-DD
- **Context:** brief description of when this pattern appears
- **Candidate for:** concept | skill | rule (agent's assessment)

## Resolved

(Observations that were promoted, dismissed, or merged)
```

---

## Deferred format

```markdown
# Deferred

Items to surface in future sessions. The app checks this file on start
and during heartbeat. Items with past due dates are presented to the user.

## Pending

- [YYYY-MM-DD] reminder: description of what to remind
- [YYYY-MM-DD] review: description of what to review
- [YYYY-MM-DD] decision: description of pending decision

## Done

(Moved here when actioned — keeps audit trail)
```

---

## Open questions (for iteration)

1. **Language of AGENTS.md:** English always (since the LLM reads it), or in
   the user's language? Probably English (it's instructions, not content) but
   verify the user doesn't see it unless they explicitly open the file.

2. **How much personality in SOUL.md by default?** Current AB is opinionated
   and pushy. For a non-technical user's first experience, is that ideal or
   intimidating? Possibly start warmer and let the personality emerge with use.

3. **Consolidation skill length:** The current skills are 200+ lines each.
   For the app (single parameterized skill), what's the right balance between
   comprehensive and token-efficient?

4. **Template versioning:** When the app updates, should it check if the user's
   AGENTS.md is outdated and offer to update? Or is it frozen at install time?
   (Current AB has `/update` for this — app equivalent needed.)

---

## Testing approach

Templates are tested by **conversation evaluation**, not unit tests:

1. Create a fresh instance from templates
2. Simulate 5-10 typical conversations (tasks, ideas, questions, captures)
3. Evaluate:
   - Does the agent route correctly? (user/ vs agent_brain/)
   - Does it capture without being told?
   - Does it write to files and not just talk about it?
   - Does the first conversation produce a reasonable USER.md?
   - Does it respect zone boundaries? (not trying to write outside AB dir)
   - Does it NOT attempt bash? (no "let me run a command...")
4. Score: pass if 4/5 conversations produce correct behavior
5. Iterate: adjust template wording where failures occur

This can be partially automated using Pi's JSON mode for scripted eval runs.
