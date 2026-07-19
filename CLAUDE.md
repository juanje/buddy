# AB App

## What this is

A native desktop app (Tauri + Pi SDK) that gives non-technical users a personal
assistant with persistent memory. You are implementing it feature by feature
using BDD + TDD.

## How to work in this project

### Process (strict, every feature)

1. Pick the next FR from `specs/SPEC.md` following the phase order below
2. Write/verify the `.feature` file in `specs/features/` (Gherkin)
3. Write step definitions in `tests/steps/` that make the feature executable
4. Implement the code — TDD: red → green → refactor
5. All tests pass before moving to the next feature
6. Commit with FR-ID: `feat(scope): FR-ID description`

### Phase order (implement in this sequence)

**Phase 0 — Architecture PoC:**
1. FR-CHAT-02 (user input + send) — basic Tauri window + worker connection
2. FR-CHAT-01 (streaming display) — Pi SDK session + subscribe
3. FR-CHAT-03 (abort) — session.abort()
4. FR-CHAT-07 (auto-scroll) — UI polish

**Phase 1 — MVP (after Phase 0 is green):**
1. FR-SETUP-01/02/03 (wizard + AB creation)
2. FR-PROMPT-01 (system prompt assembly)
3. FR-PERM-01/02 (permission zones)
4. FR-SESSION-01/02 (resume + new session)
5. FR-REFLECT-01/02 (skeleton + catch-up)
6. FR-DEFERRED-01 (surface on start)
7. FR-INGEST-01/02 (drag & drop)
8. FR-GIT-01/02 (auto-commit + index)

### Rules

- Never implement without a test first. Feature file → step definitions → code.
  Why: prevents drift between spec and implementation; the test IS the contract.
- One feature at a time. Do not start the next FR until current is green.
  Why: dependencies between features mean a broken FR-01 undermines FR-02.
- The spec is the source of truth. Code must match spec. If you think the spec
  is wrong, stop and ask — do not silently diverge.
  Why: the user made deliberate design decisions recorded in the spec; unilateral
  changes lose that reasoning.
- Commit after each feature (or logical sub-step within a feature).
  Why: git history is the project's memory; small commits are reviewable and revertable.
- Reference FR-ID in every commit message.
  Why: traceability from commit → requirement → design decision.
- Unit tests for deterministic logic (permissions, parsers, scheduler counters).
  Feature tests for user-facing behavior (chat, wizard, ingest).
  Why: unit tests are fast and precise for pure functions; feature tests validate
  the user experience end-to-end.

### Commit convention

```
feat(scope): FR-ID description
test(scope): FR-ID feature/step definitions
fix(scope): FR-ID fix description
docs: update spec/docs
chore: tooling, deps, config
```

## Key files

| File | Read when |
|------|-----------|
| `specs/SPEC.md` | Starting a new feature — find the FR, read its acceptance criteria |
| `specs/features/*.feature` | Before implementing — the test you must make pass |
| `docs/app-spec-tauri.md` | Need technical details (architecture, API patterns, data flows) |
| `docs/app-design-principles.md` | Need to understand WHY a decision was made |

## Architecture (brief)

```
Frontend (Svelte, system webview)
    │ kkrpc
    ▼
Node.js Worker (TypeScript)
    ├── Pi SDK: createAgentSession({ excludeTools: ["bash"] })
    ├── Permission layer (beforeToolCall — chained)
    ├── Hebbian tracker (afterToolCall — chained)
    ├── Scheduler + Consolidation runner
    └── Setup, Reflect, Sync modules
    │
    ▼
AB File System (git repo): agent_brain/ + user/ + logs/
```

**Key technical patterns:**
- System prompt: `DefaultResourceLoader({ systemPrompt })` → `createAgentSession({ resourceLoader })`
- Bash disabled: `excludeTools: ["bash"]` — file tools only (read, write, edit, ls, find, grep)
- Hook chaining: save original `beforeToolCall`/`afterToolCall`, install ours, delegate to original
- Session resume: `SessionManager.continueRecent(cwd)` (falls back to `.create(cwd)`)
- Separate session for maintenance (consolidation never touches user's live session)
- Events: `agent_start/end`, `message_start/update/end`, `tool_execution_start/end`, `compaction_start/end`

## Project structure

```
ab-app/
├── specs/
│   ├── SPEC.md              # Requirements (the WHAT)
│   └── features/            # .feature files (Gherkin)
├── docs/                    # Design docs (WHY + HOW)
├── src-tauri/               # Rust shell (~30 lines)
├── backends/                # Node.js worker (all logic)
├── shared/                  # TypeScript types (WorkerAPI, FrontendAPI)
├── src/                     # Frontend (Svelte)
├── tests/
│   ├── steps/               # BDD step definitions
│   ├── unit/                # Unit tests (vitest)
│   └── fixtures/            # Test data
├── templates/               # AB directory templates (bundled with app)
└── package.json
```

## Tech stack

- **App shell:** Tauri v2 (Rust, minimal — window + tray + plugins)
- **Worker:** Node.js via `tauri-plugin-js` + kkrpc for type-safe RPC
- **Agent:** Pi SDK (`@earendil-works/pi-coding-agent` v0.80.x)
- **Frontend:** Svelte 5
- **Git:** `simple-git` (wraps system binary)
- **Testing:** vitest (unit) + cucumber-js (BDD features)
- **Markdown:** marked + highlight.js
