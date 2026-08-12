# Reflect and Consolidation

Buddy's memory isn't a passive recording — it's actively maintained through cycles that mirror how you'd review your own notes if you were disciplined about it.

## Reflect: end of every session

When a session ends, Buddy reviews what happened and captures anything worth keeping:

- **Decisions** — what was decided and why.
- **Tasks captured** — action items that were added to your inbox or projects.
- **Context** — background details, personal updates, things that help Buddy understand what's going on in your life.
- **Lessons** — patterns or mistakes worth remembering.
- **Open threads** — things that were started but not finished.

This produces a structured entry in the daily log (`logs/YYYY-MM-DD.md`). If you had multiple sessions in a day, each one adds a section to the same log.

Reflect runs automatically — you don't trigger it, and you don't need to wait for it.

## Consolidation depths

Beyond reflect, Buddy runs progressively deeper maintenance cycles. The basic doc calls these "daily", "weekly", and "monthly" — those are functional names that describe how they feel in practice. Internally, they're **depth levels** triggered by a heartbeat mechanism:

### Depth 1 (daily)

Runs after every few sessions or when ~24 hours have passed since the last depth-1 cycle:

- **Inbox triage** — reviews your inbox, checks if anything needs attention, surfaces priorities.
- **Journal entry** — writes a third-person summary of your day to `user/journal/`. Activities, people, feelings, reflections — the things that make up your life beyond tasks.
- **Deferred queue** — checks for reminders or decisions that are due, and queues them so they appear at the start of your next session.
- **Observations** — notes patterns it's seeing for the first time. If a pattern keeps appearing, it eventually becomes a permanent concept. See [How Buddy learns](how-buddy-learns.md).
- **Index updates** — keeps navigation files current so it can find things quickly.

### Depth 2 (weekly)

Runs after several depth-1 cycles have accumulated:

- **Pattern synthesis** — looks across recent logs for recurring themes.
- **Weekly journal** — writes a summary of the period to your journal.
- **Project review** — checks if projects have stalled or if next actions need updating.

### Depth 3 (monthly)

Runs after several depth-2 cycles have accumulated:

- **Knowledge reorganization** — groups related concepts, consolidates scattered notes.
- **Archive rotation** — moves old daily logs to `logs/archive/YYYY-MM/`. The logs aren't deleted — they're still searchable, just not in the way.
- **Idea review** — checks on ideas that have been sitting without progress.
- **Structure cleanup** — removes stale index entries, fixes broken links.

## When do these run?

Consolidation is evaluated via a **heartbeat** — Buddy periodically checks whether maintenance is due while the app is running, and also checks when a new session starts. Trigger conditions are based on accumulated activity and lower-depth cycles, not calendar boundaries (end of day, start of week).

| Level | Trigger condition | What it feels like |
|---|---|---|
| Reflect | End of every session | Seconds after you close the chat |
| Depth 1 | Every few sessions or ~24h since last | Roughly daily |
| Depth 2 | After several depth-1 cycles | Roughly weekly |
| Depth 3 | After several depth-2 cycles | Roughly monthly |

Buddy needs to be running for maintenance to happen — it's not a background service that runs while the app is closed. If you haven't used Buddy in a while, lighter maintenance will run when you return. Deeper levels depend on accumulated activity, not just elapsed time, so they may take a few sessions to catch up.

## What consolidation produces

Every consolidation cycle ends with a git commit. This means every state of your knowledge is recoverable. See [Git safety net](git-safety-net.md).

The deferred queue (`agent_brain/deferred.md`) is how consolidation talks to you. If a maintenance cycle finds something you need to know about — a reminder that's due, a decision that's been pending too long, data that looks stale — it writes an entry to the queue. Buddy presents these at the start of your next session, before you even ask anything.
