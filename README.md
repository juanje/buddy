<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/buddy-logo-on-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="brand/buddy-logo-on-light.png">
  <img src="brand/buddy-logo-universal.png" width="386" alt="Buddy">
</picture>

A native desktop app that gives non-technical users a personal assistant with persistent, learning memory. You talk; it captures, organizes, remembers, and improves over time.

![Buddy chat interface](images/chat_welcome.jpg)

## What is Buddy?

Imagine a personal assistant that actually remembers what you discussed last week. Buddy is an AI assistant that lives on your computer and acts as your second brain.

Unlike standard web chats that start with amnesia every morning, Buddy builds a structured memory in the background. You don't need to manage files, write complex prompts, or learn terminal commands. You just talk to it.

## What makes it different

- **Remembers across sessions:** Decisions, tasks, ideas, context — nothing is lost between conversations.
- **Learns from use:** Patterns emerge, concepts form, behavior adapts — not through configuration, but through accumulated interaction.
- **Reminds you organically:** Buddy surfaces deadlines and dated to-dos you only mentioned in passing, natively through OS notifications.
- **Private and transparent:** All memory is saved as plain markdown files in a local folder. No dark databases, no cloud sync, no telemetry. You own your data.
- **Provider independence:** Switch between Anthropic, OpenAI, or Google at any time — your agent's memory stays intact because it lives in local files, not in a provider's cloud.

## Easy setup

Getting started is as simple as clicking through a friendly wizard. No technical knowledge required.

<table><tr>
<td><img src="images/provider_selection.jpg" alt="Provider selection"></td>
<td><img src="images/personalization.jpg" alt="Personalization"></td>
</tr></table>

## Download and install

Download the latest macOS (`.dmg`, `.app`) and Linux (`.deb`, `.rpm`) installers from the **[Releases page on GitHub](https://github.com/juanje/buddy/releases)**.

---

## Under the hood: for developers

Built with **Tauri v2** (native shell) + **Pi SDK** (LLM agent runtime) + **git-backed markdown** (portable, transparent memory).

### Architecture

```text
Frontend (Svelte 5, system webview)
    │ kkrpc (type-safe bidirectional RPC)
    ▼
Node.js Worker (TypeScript)
    ├── Pi SDK: createAgentSession({ tools: [...], excludeTools: ["bash"] })
    ├── Permission layer (zone-based file access control)
    ├── Session lifecycle (auto-commit, reflect on shutdown)
    └── App logger (.buddy/logs/ JSONL instrumentation)
    │
    ▼
buddy directory (git repo, user's data)
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
- **Proven memory architecture:** The cognitive logic and memory system are the result of months of daily experimentation with **[Agentic Buddy](https://github.com/juanje/agentic-buddy)**. Check out that repository to dive deeper into the theory and foundational logic behind this app's memory layer.


### Prerequisites

- **Node.js** >= 22
- **Rust** (for Tauri native shell)
- **Git** (manages the user's buddy repository)

Bun is also required to compile the worker sidecar, but it ships as a
devDependency — `npm install` covers it.

### Getting started

```bash
npm install
npm run tauri dev       # launch the app (Tauri + Vite dev server)
```

In dev the worker runs from source under `tsx`. For a packaged build it is
compiled into a standalone binary first:

```bash
npm run build:worker    # bun --compile → src-tauri/binaries/agent-worker-<target>
npm run tauri build     # bundle the app (.dmg/.app, .deb/.rpm)
```

### Testing

The project uses **BDD** (Cucumber/Gherkin) for feature acceptance and
**Vitest** for unit tests. Both must pass before any feature is considered done.

```bash
npm test                # run everything (unit + BDD)
npm run test:unit       # unit tests only (vitest)
npm run test:bdd        # BDD scenarios only (cucumber-js)
npm run typecheck       # TypeScript type checking (tsc --noEmit)
```

The full quality gate is three commands, all of which must pass before a
commit: `npx tsc --noEmit`, `npx vite build` (the only one that checks
`.svelte`) and `npm test`.

### Releasing

Set the version with `npm run version:set <semver>`, write
`docs/releases/v<semver>.md`, then commit, tag and push. Pushing the tag runs
the quality gate, builds installers for macOS (ARM64 + x64) and Linux, and
opens a **draft** release with those notes as its body.

Full steps and the release-note template: **[docs/releases/](docs/releases/)**.

### Project structure

```
backends/       — Node.js worker: session lifecycle, reflect, git, permissions, OAuth
shared/         — Types and utilities shared between frontend and worker
src/            — Svelte 5 frontend: chat UI, setup wizard, i18n
src-tauri/      — Tauri v2 native shell (Rust)
templates/      — Default files for new buddy instances (AGENTS.md, skills, identity)
specs/          — SPEC.md (requirements) + Gherkin feature files
tests/          — Unit tests (tests/unit/) and BDD step definitions (tests/steps/)
docs/           — Design principles, technical architecture, decisions
```

### Documentation

| Document                                                       | Purpose                                               |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| [specs/SPEC.md](specs/SPEC.md)                                 | Functional and non-functional requirements (the WHAT) |
| [docs/app-design-principles.md](docs/app-design-principles.md) | Design principles and rationale (the WHY)             |
| [docs/app-spec-tauri.md](docs/app-spec-tauri.md)               | Technical architecture and Pi SDK usage (the HOW)     |
| [docs/context-and-tokens.md](docs/context-and-tokens.md)       | Token usage, context-window pressure, and determinism |
| [CLAUDE.md](CLAUDE.md)                                         | Agent workflow: BDD+TDD process, phase order, rules   |
| [PROGRESS.md](specs/PROGRESS.md)                               | Implementation status and next focus                  |

### License

GPL-3.0 — see [LICENSE](LICENSE).
