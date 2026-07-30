# buddy

## What this is

A native desktop app (Tauri + Pi SDK) that gives non-technical users a personal
assistant with persistent memory. You are implementing it feature by feature
using BDD + TDD.

## How to work in this project

### Process (strict, every feature)

1. Read `specs/PROGRESS.md` — find the current focus (next feature to implement)
2. Read the FR's acceptance criteria in `specs/SPEC.md`
3. Write/verify the `.feature` file in `specs/features/` (Gherkin)
4. Write step definitions in `tests/steps/` that make the feature executable
5. Implement the code — TDD: red → green → refactor
6. All tests pass before moving to the next feature
7. Update `PROGRESS.md`: mark feature as `done`, add commit hash, set next focus
8. Commit with FR-ID: `feat(scope): FR-ID description`

### Current state (2026-07-30)

Phase 0 and Phase 1 are complete and released through **v0.1.9**. Three
campaigns followed and all are closed: H1–H8 from an external code review, the
local-model evaluation, and the maintenance audit. See `specs/PROGRESS.md` for
current state and `docs/releases/` for per-release detail.

**Current focus: polishing UX, infrastructure, CI and distribution.** The MVP
feature set is in place; the work now is making what exists pleasant to use and
reliable to install, not adding capability. Distribution counts as UX upstream —
a package that installs badly, or a platform with no build, is a user who never
reaches the UI. `specs/PROGRESS.md` has the verified state of both.

**FR-WIKI is not next.** It is an extra feature to be added once the MVP is
considered finished — do not propose it, and do not frame work as leading up to
it. Same for FR-PROVIDER. Both are in the PROGRESS backlog.

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

### What repeated failures have taught this project

These are not style preferences. Each one cost a defect that shipped.

- **Test the composition, not just the component.** A function can be correct
  and never called. The Hebbian layer passed its unit tests for months while
  recording nothing, because no test drove the real event flow. If a fix is "the
  call was missing", a test of the callee cannot catch its regression.
- **A rule only governs what a rule can reach.** Several defects were already
  forbidden in a prompt or in `AGENTS.md`. The instruction did not fail — it did
  not apply, because the failure occurred without anyone disobeying. When a
  failure needs no disobedience, enforcement belongs in code.
- **A test asserting something does *not* happen deserves suspicion.** Six tests
  in one stretch had to be rewritten because they had pinned a defect in place
  as though it were a requirement. Ask whether it describes a decision or a
  limitation.
- **Reintroduce the bug to check the test.** A test written after a fix often
  passes with the fix removed. Verify it fails.
- **Prefer behavioural tests to source-text scans.** A scan checking that a call
  exists breaks on refactors with the behaviour intact, and passes when the call
  is present but unreachable.
- **"Reported success" is not evidence.** Duration, side effects and the actual
  artefact are. A consolidation that "succeeded" in 22 ms did nothing.

### Quality gate (all three, before every commit)

```
npx tsc --noEmit      # types + dead imports/locals (noUnusedLocals)
npx vite build        # tsc does NOT check .svelte — this is what catches
                      # broken components and orphaned CSS
npm test              # vitest + cucumber
```

`vite build` is not optional. It was added to the gate after a refactor left
orphaned CSS that `tsc` reported as clean.

`tsc` also runs `noUnusedLocals`/`noUnusedParameters`. Eight dead imports had
accumulated where `strict` alone saw nothing wrong. Prefix a deliberately
unused parameter with `_` rather than turning the flag off.

Note what `vite build` still does **not** check: a `.svelte` file referencing a
CSS custom property that nobody defines builds cleanly, because
`var(--typo, #hex)` renders the fallback. `tests/unit/design-tokens.test.ts`
covers that (NFR-ACC-04).

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
| `specs/PROGRESS.md` | Check current state: what's done, what's next |

## Architecture (brief)

```
Frontend (Svelte, system webview)
    │ kkrpc  (spawned by tauri-plugin-js)
    ▼
Worker (TypeScript)
    │  dev:  backends/agent-worker.ts under tsx
    │  prod: bun-compiled sidecar, entered at backends/sidecar-entry.ts,
    │        which installs polyfills + embedded assets, then imports
    │        agent-worker.ts — or reflect-child.ts when argv has --reflect
    │
    ├── Pi SDK: createAgentSession({ excludeTools: ["bash"] })
    ├── Permission layer (beforeToolCall — chained)
    ├── Hebbian tracker (paired tool_execution_start/end — see below)
    ├── Scheduler + Consolidation runner
    └── Setup, Reflect, Sync modules
    │
    ▼
buddy directory (git repo): agent_brain/ + user/ + logs/
```

The dev/prod split is the one to keep in mind: the repo tree does not exist
inside the compiled binary, so anything reading `templates/` or
`bundled/prompts/` from disk works in dev and fails when packaged. That is what
`embedded-assets.generated.ts` exists for.

**Key technical patterns:**
- System prompt: `DefaultResourceLoader({ systemPromptOverride })` → `createAgentSession({ resourceLoader })`
- Bash disabled: `excludeTools: ["bash"]` — file tools only (read, write, edit, ls, find, grep)
- Hook chaining: save original `beforeToolCall`, install ours, delegate to original (permissions only)
- Session resume: `SessionManager.create(cwd)` — fresh session every launch; continuity via file memory
- Separate session for maintenance (consolidation never touches user's live session)
- Events: `agent_start/end`, `message_start/update/end`, `tool_execution_start/end`, `compaction_start/end`
- **`tool_execution_end` carries no `args`** — only `toolCallId`, `toolName`,
  `result`, `isError`. Any code needing the path must pair it with the matching
  `tool_execution_start`. `SessionTracker.recordEvent` already does this and
  returns the resolved call; do not keep a second map that can disagree with it

## Project structure

```
buddy/
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
│   └── unit/                # Unit tests (vitest)
├── templates/               # buddy directory templates (initial instance content)
├── bundled/prompts/         # Core prompts (skill tools + consolidation)
└── package.json
```

## Tech stack

- **App shell:** Tauri v2 (Rust, minimal — window + tray + plugins)
- **Worker:** spawned by `tauri-plugin-js`, kkrpc for type-safe RPC. Node+tsx in
  dev; a bun-compiled sidecar binary (`externalBin`) in production.
- **Agent:** Pi SDK (`@earendil-works/pi-coding-agent` v0.80.x)
- **Frontend:** Svelte 5
- **Git:** `simple-git` (wraps system binary)
- **Testing:** vitest (unit) + cucumber-js (BDD features)
- **Markdown:** marked + highlight.js
