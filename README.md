# AB App

A native cross-platform desktop app that gives non-technical users a personal
assistant with persistent, learning memory. Built with Tauri v2 + Pi SDK.

## Documentation

| Document | Purpose |
|----------|---------|
| [specs/SPEC.md](specs/SPEC.md) | Functional & non-functional requirements (the WHAT) |
| [docs/app-design-principles.md](docs/app-design-principles.md) | Design principles and decisions (the WHY) |
| [docs/app-spec-tauri.md](docs/app-spec-tauri.md) | Technical architecture (the HOW) |
| [CLAUDE.md](CLAUDE.md) | Agent instructions: workflow, rules, phase order |

## Quick Start

> **Status:** Pre-implementation. Start with Phase 0 (Architecture PoC).

```bash
# Prerequisites
# - Node.js >= 22
# - Rust (for Tauri)
# - Git

# Setup (once scaffolding is created)
npm install
npm run tauri dev
```

## Architecture

```
Frontend (Svelte, system webview)
    │ kkrpc (type-safe bidirectional RPC)
    ▼
Node.js Worker (TypeScript)
    ├── Pi SDK: createAgentSession()
    ├── Permission layer (beforeToolCall hook)
    ├── Hebbian tracker (afterToolCall hook)
    ├── Heartbeat scheduler
    └── Consolidation runner (separate Pi session)
    │
    ▼
AB File System (git repo, user's data)
```

## License

MIT
