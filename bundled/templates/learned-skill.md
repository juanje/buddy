# How to create a learned skill

A learned skill is a reusable procedure that Buddy discovers automatically. When you create the file with the right frontmatter, the next session registers it as a tool — no other registration needed.

## File location

`agent_brain/skills/verb-object.md`

## Required frontmatter

- **tool_name** — snake_case, verb_object pattern. This becomes the tool name the LLM sees. Must be unique across all skills.
- **tool_description** — One or two sentences describing WHEN to use this skill. This is the trigger: the LLM reads it and decides whether to invoke the tool. Quality here is critical.
- **summary** — One line for indexes and Hebbian scoring.
- **created** — Date of creation (YYYY-MM-DD).

## Writing a good tool_description

The description answers: "In what situation should I invoke this?"

Good: "Run when the user asks for a TPO status pulse, reviews TPO Slack channels, or prepares for a TPO meeting. Produces a cross-source briefing. Information-only; never creates tasks."

Bad: "TPO intelligence tool." (Too vague — when does it fire?)

Bad: "Analyzes Slack messages and meetings and Jira and capacity and releases and pipelines and..." (Enumeration without judgment.)

Rules of thumb:

- Lead with the user trigger ("when the user asks for...")
- Name the output ("produces a briefing", "returns a draft")
- State constraints ("information-only", "does not modify files")
- Keep it under 3 sentences

## Writing the procedure

The body starts with `## Procedure` and uses numbered steps.

For each step, include its **purpose** when not obvious. Distinguish fixed steps from judgment calls marked with "(adapt)".

## Modes

Optional `## Modes` section when a skill supports multiple modes (e.g. pulse vs update).

## What a learned skill is NOT

- Not a Claude Code / Pi SKILL.md (no auto-trigger runtime, no CLI registration, no cron)
- Not a task or reminder
- Not a one-time instruction ("format this as a table")
- Not a procedure too specific to reuse in other conversations

## Lifecycle

- Created by the agent (in conversation or during consolidation)
- Registered automatically at next session boot
- Usage tracked via skill-usage-tracking
- Consolidation reviews skills for friction and enrichment (W6)
- If unused, the file stays but is never forcibly removed
