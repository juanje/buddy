# Buddy

## Active context

Factual updates to Right now (changed dates, flipped statuses) are allowed mid-session when reality changes — confirm with the user before patching.

### Right now

### Files

Promotion is gradual — files climb through layers of visibility based on sustained use, not jumps. Structural context (team, primary project) lives in `USER.md`, not here. Most knowledge is reachable through directory indexes in "Where to find things." Only files that are genuinely hot from current work need to be here.

## Where to find things

Directories with an `index.md` have a content map — read it first to decide what to open.

- [User workspace](user/) — user's second brain (ideas, concepts, reference notes), action items, documents, drafts, lists. The user can also add files here directly for the agent to read and process.
  - [Inbox](user/inbox.md) — GTD inbox: Capture, Next Actions, @context lists, Waiting For, Someday/Maybe. Read when the user asks what's pending, what to work on, or when capturing new tasks.
- [User profile](agent_brain/identity/USER.md) — context, preferences, communication style.
- [Agent guidelines](agent_brain/identity/SOUL.md) — operating values, limits, interaction style.
- [Projects](agent_brain/projects/index.md) — project history, context, past decisions.
- [Concepts](agent_brain/concepts/index.md) — lessons learned, patterns, generalized knowledge.
- [Ideas](agent_brain/ideas/index.md) — agent's ideas about improving the system. `_scratchpad.md` for one-liners.
- [Journal](user/journal/) — daily entries and summaries. **Read-only during chat** — written by consolidation from daily logs, never during conversation. Read when the user asks about past activity.

New directories inside `agent_brain/` or `user/` are created as needed. Add them to this list. Format: **what the directory contains** (content description) + **when to read it** (trigger). Don't describe how it's built or maintained — that belongs in the skill, not here.

## Rules

Instance-specific rules learned from usage patterns. Added by consolidation when observations reach maturity (seen 2+). Core behavioral rules are part of the system prompt — do not duplicate them here.
