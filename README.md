# Buddy

A native desktop app that gives non-technical users a personal assistant with
persistent, learning memory. You talk; it captures, organizes, remembers, and
improves over time.

Built with **Tauri v2** (native shell) + **Pi SDK** (LLM agent runtime) +
**git-backed markdown** (portable, transparent memory).

## What AB does

- **Remembers across sessions.** Decisions, tasks, ideas, context — nothing is
  lost between conversations.
- **Learns from use.** Patterns emerge, concepts form, behavior adapts — not
  through configuration, but through accumulated interaction.
- **Stays transparent.** All memory is plain markdown files in a git repo. You
  can read, edit, or move them to any other tool.
- **Works with any major LLM provider.** Anthropic (Claude), OpenAI, Google
  (Gemini) — authenticate via OAuth or API key.

## Architecture

```
Frontend (Svelte 5, system webview)
    │ kkrpc (type-safe bidirectional RPC)
    ▼
Node.js Worker (TypeScript)
    ├── Pi SDK: createAgentSession({ excludeTools: ["bash"] })
    ├── Permission layer (zone-based file access control)
    ├── Session lifecycle (auto-commit, reflect on shutdown)
    └── App logger (.ab-app/logs/ JSONL instrumentation)
    │
    ▼
AB Directory (git repo, user's data)
    ├── AGENTS.md          — portable behavioral rules
    ├── agent_brain/       — agent's learned knowledge
    ├── user/              — user's tasks, drafts, journal
    └── logs/              — daily session logs (process-conversation format)
```

Key design choices:

- **File tools only** — no bash, no shell. The agent reads and writes markdown.
- **Toolless reflect** — the background LLM that summarizes sessions has no
  tools; it distills the forked conversation context into text. Deterministic
  code handles all file I/O.
- **Dual-use compatible** — the same AB directory works in the app, Cursor, or
  Claude Code. Formats are identical; `AGENTS.md` provides fallback rules for
  any AI editor.

## Prerequisites

- **Node.js** >= 22
- **Rust** (for Tauri native shell)
- **Git** (manages the user's AB repository)

## Getting started

```bash
npm install
npm run tauri dev       # launch the app (Tauri + Vite dev server)
```

## Testing

The project uses **BDD** (Cucumber/Gherkin) for feature acceptance and
**Vitest** for unit tests. Both must pass before any feature is considered done.

```bash
npm test                # run everything (unit + BDD)
npm run test:unit       # unit tests only (vitest)
npm run test:bdd        # BDD scenarios only (cucumber-js)
npm run typecheck       # TypeScript type checking (tsc --noEmit)
```

**Current status:** 24 unit test files (96 tests), 24 feature files (87 scenarios passing, 5 undefined for upcoming features).

## Project structure

```
backends/       — Node.js worker: session lifecycle, reflect, git, permissions, OAuth
shared/         — Types and utilities shared between frontend and worker
src/            — Svelte 5 frontend: chat UI, setup wizard, i18n
src-tauri/      — Tauri v2 native shell (Rust)
templates/      — Default files for new AB instances (AGENTS.md, skills, identity)
specs/          — SPEC.md (requirements) + Gherkin feature files
tests/          — Unit tests (tests/unit/) and BDD step definitions (tests/steps/)
docs/           — Design principles, technical architecture, decisions
```

## Documentation

| Document | Purpose |
|----------|---------|
| [specs/SPEC.md](specs/SPEC.md) | Functional and non-functional requirements (the WHAT) |
| [docs/app-design-principles.md](docs/app-design-principles.md) | Design principles and rationale (the WHY) |
| [docs/app-spec-tauri.md](docs/app-spec-tauri.md) | Technical architecture and Pi SDK usage (the HOW) |
| [CLAUDE.md](CLAUDE.md) | Agent workflow: BDD+TDD process, phase order, rules |
| [PROGRESS.md](PROGRESS.md) | Implementation status and next focus |

## License

GPL-3.0 — see [LICENSE](LICENSE).
