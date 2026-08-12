# Where Things Live

Buddy organizes everything into a few top-level directories, each with a clear purpose. When you tell Buddy something, it decides where to put it based on what kind of information it is.

## The routing rule

**"Will you act on this?"** → `user/` (your workspace).
**"Will Buddy learn from this?"** → `agent_brain/` (Buddy's memory).
**"Is this a record of what happened?"** → `logs/` (history).

## Your workspace: `user/`

This is your space. Buddy writes here on your behalf, but you own the content.

- **`user/inbox.md`** — your GTD inbox. New tasks, reminders, and action items land here. Organized by context (@computer, @phone, @errands) with Next Actions, Waiting For, and Someday/Maybe sections.
- **`user/projects/`** — multi-step outcomes. Each project has its own file with outcome, next action, notes, and history.
- **`user/wiki/`** — [your second brain](../wiki.md). Interconnected concept pages built from documents you share, ideas you discuss, and knowledge you want to keep. Organized by category with cross-references and tags.
- **`user/journal/`** — your personal diary. Daily entries about activities, people, feelings, and reflections. Written in third person during daily consolidation. Structure: `YYYY/MM/DD.md` (daily), `YYYY/weekly/WNN.md` (weekly), `YYYY/MM.md` (monthly summary).

## Buddy's memory: `agent_brain/`

This is what Buddy knows about you and about the world. It manages this automatically.

- **`agent_brain/identity/USER.md`** — your profile. Name, preferences, location, work, people in your life. Updated from conversations — Buddy tells you when it adds something.
- **`agent_brain/identity/SOUL.md`** — Buddy's own character definition. How it behaves, its values, its interaction style. Changes only with your explicit approval.
- **`agent_brain/concepts/`** — lessons learned and generalized knowledge. Things Buddy figured out from repeated experience. See [How Buddy learns](how-buddy-learns.md).
- **`agent_brain/observations.md`** — patterns Buddy has noticed but hasn't yet confirmed. A staging area for future concepts.
- **`agent_brain/deferred.md`** — the queue of things Buddy needs to tell you. Written during consolidation, presented at the start of your next session, removed once addressed.
- **`agent_brain/projects/`** — context about your projects from Buddy's perspective: past decisions, history, technical notes.

## History: `logs/`

Daily records of what happened in each session.

- **`logs/YYYY-MM-DD.md`** — one file per day, with structured sections: decisions, tasks captured, context, lessons, open threads.
- **`logs/archive/YYYY-MM/`** — older logs moved here during monthly consolidation. Still searchable, just not in the way.

## How Buddy decides where to put things

| You say... | Buddy puts it in... | Why |
|---|---|---|
| "Remind me to call Pedro on Friday" | `user/inbox.md` (with date) | Action item — surfaced when the date arrives |
| "I prefer morning meetings" | `agent_brain/identity/USER.md` | Preference about you |
| "Save this idea about distributed teams" | `user/wiki/` | Your knowledge — goes to your second brain |
| "I had lunch with my mother today" | Daily log + `user/journal/` | Personal life context |
| "Let's track the kitchen renovation as a project" | `user/projects/kitchen-renovation.md` | Multi-step outcome |
| "I learned that batch commits are safer" | `agent_brain/concepts/` (if pattern) or `agent_brain/observations.md` (if first time) | Knowledge Buddy acquires about how to work |

If Buddy puts something in the wrong place, tell it — it'll move it. The routing is a best guess, not a rigid rule.
