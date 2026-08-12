# Memory Internals

How Buddy's memory system works under the hood. These docs are for users who want to understand the mechanics — they're not required for normal use.

Start with [How memory works](../how-memory-works.md) for the overview.

## Pages

- [reflect-and-consolidation.md](reflect-and-consolidation.md) — When reflect and consolidation run, what each level produces, and how the deferred queue communicates with you.
- [hebbian-scoring.md](hebbian-scoring.md) — How frequently used knowledge rises to the surface and unused knowledge fades without disappearing.
- [where-things-live.md](where-things-live.md) — What goes where and why: routing rules for identity, tasks, knowledge, and logs.
- [how-buddy-learns.md](how-buddy-learns.md) — The pipeline from first observation to permanent concept.
- [git-safety-net.md](git-safety-net.md) — How git protects your data, when commits happen, and how to recover previous states.
