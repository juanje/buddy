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

Based on exploration of the upstream template (`~/git/agentic-buddy/`).

### Files that ship as-is (minimal or no changes)

| Template file | Source | Notes |
|---|---|---|
| `agent_brain/identity/SOUL.md` | upstream `agent_brain/identity/SOUL.md` (81 lines) | Generalize (remove any instance-specific refs). Add first-session section |
| `agent_brain/identity/USER.md` | upstream `agent_brain/identity/USER.md` | As-is (placeholder with sections: About, Context, Preferences) |
| `agent_brain/observations.md` | upstream `agent_brain/observations.md` | As-is (empty with section structure: Skill/Rule/Concept/Structure candidates, Resolved) |
| `agent_brain/deferred.md` | upstream `agent_brain/deferred.md` | As-is (queue semantics documented, entry format defined, parseable by code) |
| `logs/index.md` | upstream `logs/index.md` | As-is (empty, managed by worker code) |
| `user/inbox.md` | upstream `.packs/personal/inbox.md` | As-is when personal pack applied (GTD sections: Capture, Next Actions, @context, Waiting For, Someday/Maybe) |

### Files that need rewriting

| Template file | Source | What changes |
|---|---|---|
| `AGENTS.md` | upstream `templates/CLAUDE.md` (104 lines, 16 rules) | Major rewrite — see section below |
| `agent_brain/skills/process-conversation.md` | upstream (207 lines, 6 steps) | Remove git commit step (worker handles). Remove Step 4 interactive/autonomous branching (worker decides mode). Keep Steps 1-3, 5-6 logic intact |
| `agent_brain/skills/triage-inbox.md` | upstream `.packs/personal/triage-inbox.md` (141 lines) | As-is (pure GTD procedure, no platform deps) |

### Files that DON'T ship (replaced by app code)

| Current file | Replaced by |
|---|---|
| `agent_brain/skills/consolidation.md` | `bundled/prompts/consolidation.md` deployed to `~/.buddy/prompts/` (semver refresh); worker runs consolidation via `consolidation-runner.ts` |
| `.cursor/hooks/session-start.py` | Worker initialization (loads identity + context + deferred programmatically) |
| `.cursor/hooks/auto-reflect.py` | Worker post-session handler (runs reflect internally) |
| `.cursor/hooks/auto-consolidate.py` | Worker scheduler (usage-based counters, cascade logic) |
| `.cursor/hooks.json` + `config.json` | App settings/preferences |
| `.cursor/commands/*.md` | Worker commands triggered by UI or scheduler |
| `agent_brain/skills/update-upstream.md` | App built-in update mechanism |
| `.packs/index.md` + pack structure | App setup wizard (pack selection as UI step) |

---

## AGENTS.md Design

Source: upstream `templates/CLAUDE.md` (104 lines). Sections: Core behavior (7 rules),
Idea file format, File metadata, Active context, Where to find things, Skills, Rules (16).

### What stays from current templates/CLAUDE.md

**Core behavior section (all 7 rules):**
1. Listen and capture (routing: user acts → user/, agent learns → agent_brain/)
2. Confirm what you captured
3. Present options with reasoning for decisions (user owns decisions)
4. Don't reorganize proactively
5. When in doubt, capture
6. Ask about prioritization if unclear
7. Group, don't duplicate

**Rules that stay (require LLM judgment):**
- Rule 1: All content in English (or user's language — TBD for app)
- Rule 2: Don't read files preemptively; progressive disclosure via indexes
- Rule 5: Memory first — check what you know before external tools
- Rule 6: Retention by memory type (semantic never archived, etc.)
- Rule 7: USER.md updated with observed facts; inferences marked
- Rule 9: Write it or don't say it
- Rule 10: No unsourced content; relative dates resolved
- Rule 11: Context is not a task; user tasks are not agent tasks
- Rule 13: Logs are context, not changelogs
- Rule 15: Don't edit system structures during normal sessions
- Rule 16: Execute skills silently (present result, not play-by-play)

**Other sections that stay:**
- Idea file format (seed → developing → ready → converted/archived)
- File metadata definition (last_accessed, access_count, created)
- Active context structure (Right now + Files)
- Where to find things (directory navigation map — starts empty)
- Skills section (trigger-based references — starts with core skills only)

### What is REMOVED (handled by code in the worker)

| Removed rule/instruction | Worker replacement |
|---|---|
| Rule 4: "Create directories with mkdir -p" | Worker creates dirs via fs API |
| Rule 8: "Commit regularly" | Worker auto-commits after writes |
| Rule 3: "Update metadata (last_accessed, access_count)" | Worker Hebbian tracker updates frontmatter |
| "Update logs/index.md" in consolidation steps | Worker rebuilds index after reflect appends daily log |
| Night-owl date resolution paragraph (Rule 10 partial) | Worker resolves before injecting date in context |
| Rule 14: "Current date from system" | Worker always injects current date in system prompt |
| Maintenance scheduling logic | Worker scheduler with usage-based counters |
| "Check deferred.md at session start" | Worker loads and presents deferred in system prompt |
| Platform references (.cursor/, /setup, /refresh, hooks) | App handles all lifecycle |
| File metadata exempt list (which files don't track access) | Worker exclusion rules in Hebbian config |

### What is NEW (app-specific instructions)

```markdown
## App context

You operate inside the AB app. The app handles:
- File persistence (auto-commit after your writes — you never need to commit)
- Access tracking (reads are counted automatically — don't mention it)
- Session indexing (logged automatically)
- Scheduling (consolidation runs when due — you just follow the procedure)
- Date/time (always provided in your context — use it directly)

Your tools: read, write, edit, ls, find, grep. No bash, no shell commands.
If you need something beyond file operations, tell the user you can't do it.

When the user drops or attaches a file, read it and discuss it. Structured
indexing (wiki ingest) is a separate feature they'll ask for explicitly.

Identity files (SOUL.md, USER.md): the app will ask the user to confirm
any changes you propose. Write them normally — the confirmation happens
in the UI, not in the conversation.
```

### Structural changes

- Rename from `CLAUDE.md` to `AGENTS.md` (Pi/portable convention)
- Remove the "Not yet configured / run /setup" pre-setup state (app wizard handles this)
- The "Where to find things" section starts empty and grows with use
- Skills section starts with: process-conversation, consolidation, triage-inbox

### Tone and language

Written for a capable LLM (Claude Sonnet/GPT-4o class). Concise, no
redundancy. If something is enforced by code, don't mention it — the LLM
doesn't need to know about mechanisms it can't influence.

The upstream version is already well-calibrated in tone. Main adjustment:
remove the meta-level "how to work with the editor" framing and make it
purely "how to behave as a persistent assistant."

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
