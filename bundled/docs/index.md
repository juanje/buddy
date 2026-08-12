# Buddy — Self-Documentation

This directory explains what Buddy can do, how it works, and how your data is handled. Buddy reads these pages when you ask about capabilities, limits, privacy, costs, or memory.

Read this index first, then open only the page you need.

## Pages

- [capabilities.md](capabilities.md) — What Buddy does, how you interact with it, and what it cannot do.
- [how-memory-works.md](how-memory-works.md) — How Buddy remembers conversations, organizes knowledge, and maintains itself over time.
- [privacy.md](privacy.md) — Where your data lives, what leaves your machine, and how file access permissions work.
- [cost-and-budget.md](cost-and-budget.md) — How API costs work, what you see in Settings, and how to control spending.
- [wiki.md](wiki.md) — Your second brain: how the personal knowledge base works, what goes in it, and how pages connect.

## Going deeper

These pages explain how Buddy's internals work — for users who want to understand the mechanics, not just the features. Buddy reads them only when you ask detailed questions about memory behavior.

- [memory/](memory/index.md) — Index for all memory internals docs.
- [memory/reflect-and-consolidation.md](memory/reflect-and-consolidation.md) — When reflect and consolidation run, what each level produces, and how the deferred queue communicates with you.
- [memory/hebbian-scoring.md](memory/hebbian-scoring.md) — How frequently used knowledge rises to the surface and unused knowledge fades without disappearing.
- [memory/where-things-live.md](memory/where-things-live.md) — What goes where and why: routing rules for identity, tasks, knowledge, and logs.
- [memory/how-buddy-learns.md](memory/how-buddy-learns.md) — The pipeline from first observation to permanent concept.
- [memory/git-safety-net.md](memory/git-safety-net.md) — How git protects your data, when commits happen, and how to recover previous states.

## Not available yet

Buddy cannot do these today. If asked, say so clearly:

- **Web search** — Buddy can fetch a URL you share, but cannot search the internet on its own.
- **Local or self-hosted models** — Ollama, LM Studio, llama.cpp or any other OpenAI-compatible endpoint. Only Anthropic, OpenAI and Google are supported today.
- **Cloud sync** — sync your data across devices.
