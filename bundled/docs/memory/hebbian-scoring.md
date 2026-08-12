# Hebbian Scoring

"Neurons that fire together, wire together." Buddy borrows this principle from neuroscience: knowledge that gets used becomes easier to find. Knowledge that doesn't get used fades — but never disappears.

## How it works

Every knowledge file in Buddy's memory (`agent_brain/`) has two counters in its header:

- **`last_accessed`** — the date Buddy last consulted this file for its content.
- **`access_count`** — how many times Buddy has consulted it across all sessions.

"Consulted" means Buddy opened the file to use its content — to answer a question, make a decision, or provide context. Opening a file only to edit it (adding a new entry, fixing a typo) doesn't count. The distinction matters: access count reflects how often the knowledge is *needed*, not how often it's *touched*.

## What counts as a consultation

| Action | Counts? | Why |
|---|---|---|
| Buddy reads a concept file to inform a recommendation | Yes | Knowledge applied |
| Buddy reads a project file to recall a past decision | Yes | Content used for its meaning |
| Buddy opens a file to add a new section | No | Write-only — the read is mechanical |
| Buddy reads an index to navigate to another file | No | Navigation, not content use |

## What rises

Files with high access counts and recent access dates are considered "hot." During consolidation, Buddy keeps these files prominent:

- They appear in the active context — the short list of files Buddy loads at the start of every session.
- They're referenced in directory indexes with more detail.
- They're consulted first when a topic comes up.

This means Buddy gets faster at helping with things you frequently discuss.

## What fades

Files that haven't been consulted in a long time gradually lose prominence:

- They drop out of the active context list.
- Their index entries become shorter.
- They take more steps to find (deeper in the directory hierarchy).

But they're never deleted. A file that faded months ago can still be found — Buddy just needs an extra step to locate it, like checking an index or searching. If you start discussing that topic again, the file heats back up naturally.

## The cooling mechanism

Buddy doesn't delete knowledge — it uses **depth** as the cooling mechanism:

- **Hot knowledge** → active context (loaded every session)
- **Warm knowledge** → directory indexes (one hop to find)
- **Cool knowledge** → deep in hierarchy (two+ hops to find)

This mirrors how your own memory works: you don't forget your childhood address, but you don't think about it every day either. If someone asks, you can recall it — it just takes a moment.

## What's exempt

Some files are always loaded regardless of access count — they're structural, not knowledge:

- Your identity files (`USER.md`, `SOUL.md`)
- The system prompts that define Buddy's behavior (`AGENTS.md` and related files)
- Navigation indexes
- Working files like the observation queue and deferred queue

These are the scaffolding that makes everything else work. Scoring them would be like asking whether your brain should forget how to breathe.
