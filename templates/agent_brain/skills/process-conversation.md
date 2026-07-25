---
summary: "Procedure for encoding session decisions and context into daily logs"
created:
---

# Skill: Process conversation

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

Append to `logs/YYYY-MM-DD.md` under a `## Session HH:MM–HH:MM` header. Use sections: **Decisions**, **Tasks captured**, **Ideas**, **Context**, **Lessons**, **Open threads**. If the file doesn't exist, create it with frontmatter (`date`, `last_updated`) and the log title. Update `last_updated` when modifying. Append — don't duplicate content already logged earlier today.

### 3. Verify captures

Check that everything actionable was captured in the right place:
- Action items, tasks → `user/`
- Concrete improvement ideas → `user/` or `agent_brain/ideas/`
- Unformed ideas / project concepts → `agent_brain/ideas/`
- Decisions → `agent_brain/projects/` or `agent_brain/concepts/`
- Lessons → `agent_brain/concepts/`

When information extends something that already exists, link it with intent — explain what's on the other side and why to follow it. Every link must serve the reader of this file. If anything was missed, add it now.

### 4. Patch stale active context

*May be skipped in output-only mode — follow mode instructions in your context.*

Scan **Active context → Right now** and hot files in `AGENTS.md`. Patch immediately if a near-term date/status changed or stale info would cause a concrete mistake next session. Do **not** patch long-term project context, items needing archiving, or wording improvements — consolidation handles those. Note patches briefly in the log.

### 5. Detect observations

Review for signals that the system should evolve. Only record genuine observations:

- **Skill candidate:** A reusable multi-step procedure is emerging (user asked for uncaptured workflow, or 3+ repeatable steps).
- **Rule candidate:** A behavioral correction or preference. **Explicit user correction** ("don't do X", "always Y", pointed-out mistake) → fast-track: add to AGENTS.md Rules immediately and log as resolved. **Inferred pattern** → log in observation journal; consolidation acts at 2+ occurrences.
- **Concept candidate:** A lesson or pattern that generalizes beyond today's situation.
- **Structure candidate:** Information doesn't fit current layout, or a new category has no home.
- **Stale data fixed:** Memory was wrong — note which file and what changed.

If observations exist, write them to the daily log under **## System observations** and to `agent_brain/observations.md` (increment count if the same pattern already exists). Skip if none — don't force it.

## Quality criteria

- **Be specific.** "Discussed CI/CD" is useless. "Decided to migrate from Jenkins to Tekton because of X" is useful.
- **Focus on reasoning.** Decisions and their "why" are the most valuable content.
- **Don't inflate.** If the conversation was trivial, the log can be minimal.
- **Think of future you.** The log is for someone without today's context who needs to understand when and why something was decided.
- **Append, don't overwrite.** If the log already has content from an earlier pass, add new information without duplicating.
