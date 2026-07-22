# Skill: Triage inbox

## When to use

Triggered during consolidation when `user/inbox.md` exists and has a Capture
section. Also triggered by "triage", "process inbox", "triage my inbox", or
"what should I work on?".

## Context

This skill implements the **Clarify + Organize** steps of GTD (Getting
Things Done). The inbox is a temporary landing zone — items enter easily
but must be processed out daily. An inbox that grows without bound loses
its utility (see intake-without-processing pattern).

## Procedure

### 1. Process Capture

Read `user/inbox.md`. For each item in the **Capture** section:

**Ask: "Is this actionable?"**

- **No →** route it:
  - Trash (irrelevant, outdated) → delete.
  - Reference (useful info, no action) → move to the appropriate file
    (`agent_brain/`, `USER.md`, project file, log).
  - Someday/Maybe (interesting but not now) → move to the Someday/Maybe
    section of the inbox.

- **Yes →** determine scope:
  - **Single step:** Add as a one-liner to the appropriate **@context**
    list in the inbox (e.g., @computer, @home, @errands, @calls).
  - **Multi-step (project):** Create or update a project file in
    `user/projects/<short-name>.md` (see Project file format below).
    Add the project's **next action** as a one-liner in the appropriate
    @context list, linking to the project file.
  - **2-minute rule:** If doable right now in under 2 minutes, do it
    (or note it as done in the log). Don't add it to any list.
  - **Delegated / waiting:** Add to the **Waiting For** section with
    who, what, and since when.

**Success criterion: Capture must be empty when done.**

### 2. Review Next Actions

The **Next Actions** section at the top of the inbox holds the 3–5
items that deserve immediate focus — the things to work on today or
this week.

1. Scan the @context lists. Are there items that should be promoted
   to Next Actions because they're urgent, time-sensitive, or high
   leverage?
2. Are current Next Actions still the right focus? Demote any that
   have lost urgency back to their @context list.
3. Does every item in Next Actions have a clear, concrete next step?
   If it says "work on X" instead of "do Y for X", sharpen it.
4. Keep Next Actions at **3–5 items**. More than that dilutes focus.

### 3. Quick hygiene

- Remove completed items (~~strikethrough~~ or explicitly done).
- Check **Waiting For** — any items resolved? Any stale (>2 weeks)?
  Flag stale items to the user.
- Glance at @context lists — anything obviously outdated or completed?

### 4. Report

Briefly tell the user what changed:
- Items processed from Capture (and where they went).
- Next Actions current state (what's in focus).
- Any flags (stale waiting, overloaded context list).

## Project file format

Project files live in `user/projects/` and follow this structure:

```markdown
# Project name

**Outcome:** What "done" looks like — one sentence.

**Next action:** The single next physical step. Also listed in inbox @context.

## Notes

Context, history, decisions, accumulated updates. This is where verbose
detail lives — not in the inbox.

## Related

- [Link to idea file, log, repo, or external resource]
```

When a project's next action is completed, the triage updates the project
file with a new next action (or marks it done if the outcome is achieved).

## Inbox structure reference

The inbox should have this structure after triage:

```markdown
# Inbox

## Capture
(empty after triage)

## Next Actions
- 3-5 focus items, one line each

## By context

### @computer
### @home
### @errands
### @calls

## Waiting For
- Who — what — since YYYY-MM-DD

## Someday / Maybe
```

## Quality criteria

- **One line per action.** If it needs explanation, it's a project — make
  a project file.
- **Actions, not descriptions.** Each line should start with a verb or
  clearly imply one. "Upstream AB — Wiki-style KB" is a project title;
  "Read wiki-kb test results and decide on core vs pack split" is a next
  action.
- **Context is routing, not storage.** @context lists help you pick what
  to do based on where you are and what tools you have. They're not
  permanent homes for items.
- **Inbox is a flow, not a filing cabinet.** Items enter through Capture
  and exit through triage. Nothing lives permanently in the inbox except
  the structure itself.
