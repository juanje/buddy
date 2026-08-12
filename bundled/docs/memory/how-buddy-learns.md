# How Buddy Learns

Buddy learns by listening, not by training. Every conversation gives it information that it classifies and stores according to its nature — and over time, that information transforms.

## What Buddy learns

Buddy picks up three kinds of knowledge:

**Facts about you** — your preferences, your context, the people around you, your projects, your decisions and why you made them. This is stored in your profile and your workspace. It lets Buddy resume conversations without you repeating yourself, and connect what you say today with something you discussed weeks ago.

**Patterns about how to help you** — whether a certain way of organizing information works better for you, whether a type of response is more useful, whether there are mistakes it should avoid. These patterns aren't programmed — Buddy discovers them through use. Over time, the ones that prove consistent become rules it applies automatically.

**What happened** — the record of your conversations, what was discussed, what was decided, what's still pending. This gives Buddy continuity: it can tell you "last week you decided X for this reason" because it has the history.

These three types evolve differently. Facts get updated when they change. Patterns graduate from tentative to permanent through the pipeline below. History accumulates and is periodically summarized and archived.

## The observation pipeline

```
Something happens  →  Observation  →  Concept  →  Rule
  (once)              (noted)        (confirmed)   (always applied)
```

Each stage requires more evidence than the last. Buddy doesn't jump to conclusions.

## Stage 1: Observation

When Buddy notices something for the first time — a pattern, a mistake it made, a useful approach — it writes a short note to `agent_brain/observations.md` with a counter: `seen: 1`.

Example: Buddy notices that when it opens a file just to edit it, it shouldn't count that as "consulting" the file. First time seeing this distinction. It writes an observation.

Observations are tentative. They might be noise, coincidence, or a one-off. Buddy doesn't act on them beyond noting they happened.

## Stage 2: Recurrence

If the same pattern appears again in a later session, the counter increments: `seen: 2`. Buddy doesn't go looking for observations to confirm — it notices naturally during its work and recognizes when something matches a previous note.

At `seen: 2`, an observation becomes a candidate for promotion to a concept.

## Stage 3: Concept

During consolidation, Buddy reviews observations that have been seen multiple times. If the pattern is real and generalizable, it creates a concept file in `agent_brain/concepts/` — a permanent piece of knowledge with context, examples, and implications.

Concepts are Buddy's long-term understanding. They survive consolidation, inform future decisions, and accumulate depth over time. A concept about "how the user prefers feedback" or "when consolidation loses temporal markers" stays in memory and gets richer as more instances are observed.

The observation pipeline is the most common path, but not the only one. Concepts can also be created directly from decisions made during a session, lessons explicitly discussed, or knowledge the user shares. The observation route adds a confirmation step — the concept has been seen more than once before it's formalized.

## Stage 4: Rule (rare)

If a concept proves so consistently important that it should always be active — not just findable, but always loaded — it can be promoted to a rule in Buddy's configuration. There are two kinds:

- **Identity and character changes** (how Buddy behaves, its tone, its values) require your explicit approval — Buddy proposes, you decide.
- **Working rules** (specific patterns about how to handle files, when to capture, how to route information) can emerge from repeated experience and be incorporated during maintenance without asking each time.

Most knowledge stays at the concept level. Rules are for things Buddy must never forget to do, not things it's useful to know.

## What doesn't get promoted

- **One-off observations** — if a pattern is seen once and never again, it stays in the observation queue and is eventually cleaned up during monthly maintenance.
- **User-specific facts** — "you prefer vegetarian food" is a fact about you, stored in your profile (`USER.md`), not a concept Buddy learned. Concepts are about *how things work*, not *what you like*.
- **Session-specific context** — "we were debugging the sidecar crash" belongs in the daily log, not in concepts. Concepts generalize; logs record.

## How this all fits together

Buddy's memory isn't static. What it uses frequently rises to the surface and stays close at hand (see [Hebbian scoring](hebbian-scoring.md)). What falls out of relevance moves to the background — but doesn't disappear, it's still there if needed. Patterns observed once are noted as tentative; if they recur, they consolidate as permanent knowledge. And periodically, Buddy reviews everything it has accumulated, looks for connections between ideas, groups scattered notes, and cleans up what no longer makes sense to keep active.

The result is a memory that organizes itself through use, not by prior design. And because everything is stored in files you can read, you can always see *how* Buddy arrived at what it knows — concepts trace back to observations or decisions, which trace back to specific sessions.
