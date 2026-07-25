---
summary: "GTD inbox triage procedure for captures, next actions, and hygiene"
created:
---

# Skill: Triage inbox

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
  - **Single step:** Add to the appropriate **@context** list in the inbox.
  - **Multi-step (project):** Create or update `user/projects/<short-name>.md`
    with Outcome, Next action, Notes, Related links. Add the next action
    to the matching @context list, linking to the project file.
  - **2-minute rule:** If doable right now in under 2 minutes, do it
    (or note it as done in the log). Don't add it to any list.
  - **Delegated / waiting:** Add to **Waiting For** with who, what, and since when.

**Success criterion: Capture must be empty when done.**

### 2. Review Next Actions

The **Next Actions** section holds the 3–5 items that deserve immediate focus.

1. Scan @context lists — promote urgent, time-sensitive, or high-leverage items.
2. Demote any current Next Actions that lost urgency back to their @context list.
3. Sharpen: every item must have a clear, concrete next step (verb, not project title).
4. Keep at **3–5 items**. More dilutes focus.

### 3. Quick hygiene

- Remove completed items.
- Check **Waiting For** — resolved? Stale (>2 weeks)? Flag stale to user.
- Glance at @context lists — anything obviously outdated?

### 4. Report

Briefly tell the user:
- Items processed from Capture (and where they went).
- Next Actions current state.
- Any flags (stale waiting, overloaded context list).

## Inbox structure

After triage, the inbox should have: **Capture** (empty), **Next Actions** (3–5 focus items), **By context** (@computer, @home, @errands, @calls), **Waiting For** (who — what — since date), **Someday / Maybe**.

## Quality criteria

- **One line per action.** If it needs explanation, it's a project — make a project file.
- **Actions, not descriptions.** Each line starts with a verb or clearly implies one.
- **Context is routing, not storage.** @context lists help pick what to do based on location/tools.
- **Inbox is a flow, not a filing cabinet.** Items enter through Capture and exit through triage.
