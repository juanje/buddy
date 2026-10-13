# pi-durable Impact Analysis

`@earendil-works/pi-durable` is a new package (v1.0.0, 2026-10-01) extracted
from `pi-agent-core`. It is a durable agent harness: conversations, model
turns, tool calls, and application state are committed to storage atomically.
If the process dies mid-turn, reopening the storage resumes from the last
commit.

This document evaluates what pi-durable would bring to buddy, what it would
cost, and what the risks are.

## What pi-durable provides

### Core Abstractions

| Concept | What it does |
|---|---|
| **Harness** | One open storage + agent machinery. All changes go through atomic commits. Nothing is shown before its commit is stored. |
| **Conversation** | A transcript of immutable entries. `root()` creates the root conversation; you can create more and fork them. |
| **Entry** | One immutable transcript record: user message, assistant response, tool result, system prompt change, reset, or custom. |
| **Task** | A durable state machine that checkpoints at every step. Crash → restart continues from last checkpoint. |
| **Extension** | Named bundle of tools, system prompt sections, hooks, wraps, and tasks. Declarative, not chained. |
| **Document** | Typed JSON state stored next to the transcript, changed in commits. |

### Storage Backends

- **MemoryStorage** — nothing persisted (tests).
- **SQLite** — one database file, WAL mode, crash-safe.
- **JSONL** — append-only files in one directory, optional fsync.

### Built-in Tools

`@earendil-works/pi-durable/tools` provides `read`, `write`, `edit`, and
`bash`, packaged as `CodingTools`. They operate through the call's execution
environment.

---

## Feature-by-feature comparison

### What buddy builds manually vs what pi-durable gives

| Buddy code | Lines | pi-durable equivalent |
|---|---|---|
| `session-boot.ts` — create session, mount tools, build prompt | 313 | `Harness.open()` + `root()` + extensions with tools and sections |
| `worker-core.ts` — `PiSessionLike` abstraction, event forwarding | 123 | `Conversation.submit()` / `.wait()` + `watchEvents()` |
| `session-lifecycle.ts` — event handling, git commits, reflect spawn | ~200 | Durable task lifecycle + hooks |
| `session-tracker.ts` — tool_execution_start/end pairing for paths | ~100 | `hook(ToolTask, { afterTool })` — receives args AND result together |
| `reflect-child.ts` — fork session, spawn background process | 333 | `conversation.fork()` + background durable task |
| `crash-recovery.ts` — detect stale sessions, recover | ~100 | Free. The harness is crash-safe by design. |
| `context-injection.ts` — inject hidden session context | ~80 | `submit()` with initial entries |
| `date-guard.ts` — extension to refresh prompt on day change | ~60 | `section()` with dynamic render function |
| Hook chaining in session-boot (`beforeToolCall`, `afterToolCall`) | ~40 | `hook(ToolTask, { beforeTool, afterTool })` — declarative |
| **Subtotal replaced** | **~1,350** | |

### What buddy adapts (same logic, different API)

| Buddy code | Lines | Change needed |
|---|---|---|
| `agent-worker.ts` — RPC entry point | 534 | Major rewrite of the RPC surface |
| `consolidation-runner.ts` — maintenance sessions | 715 | Subagent pattern instead of separate `createAgentSession()` |
| `permissions.ts` — trust zone enforcement | 263 | `hook(ToolTask, { beforeTool })` with block/allow |
| `hebbian.ts` — access tracking | ~150 | `hook(ToolTask, { afterTool })` — no more pairing workaround |
| `heading-guard.ts` — prevent accidental heading edits | ~80 | `hook(ToolTask, { beforeTool })` |
| `edit-recovery.ts` — recover from failed edits | ~80 | `hook(ToolTask, { afterTool })` |
| `prompt.ts` — system prompt assembly | 263 | `section()` composable functions |
| `heartbeat.ts` — periodic checks | ~200 | Partial — deferred stays, consolidation trigger changes |
| `file-tools.ts` — custom file operations | 370 | `defineTool()` with TypeBox schemas |
| `skill-tools.ts` — procedural prompts | ~120 | `defineTool()` with TypeBox schemas |
| `fetch-url.ts` — URL fetch tool | 396 | `defineTool()` with TypeBox schemas |
| Connectors (Jira, Slack), wiki-tools, etc. | ~500 | `defineTool()` with TypeBox schemas |
| `provider-auth.ts` — model runtime setup | ~200 | `createModels()` + provider factories |
| **Subtotal adapted** | **~3,870** | |

### What stays untouched

All business logic without Pi SDK dependency (~8,800 lines):

- Brain health, brain migration, consolidation mechanics
- Wiki operations (format, check, reconcile, synthesis, search)
- Reflect output formatting
- Git helpers, maintenance lock, containment checks
- Deferred items, orientation, allowed paths
- Instance creation, setup, boot refresh
- All `shared/` (brain-paths, frontmatter, dates, path-utils, etc.)
- PDF extraction, URL safety, state file management

---

## Positive Impact

### 1. Crash Recovery (the killer feature)

**Current state:** If buddy crashes mid-turn, the user loses the entire
exchange. `crash-recovery.ts` detects stale sessions and spawns a reflect
child, but the conversation itself is gone.

**With pi-durable:** Every tool call, every partial response, every state
change is committed before it is shown. Process death → `harness.resume()` →
work continues from the last commit. The user sees the conversation pick up
where it stopped.

**Impact:** This is a real, user-visible improvement. Desktop apps crash.
Power goes out. The OS kills background processes.

### 2. Hebbian tracking without the pairing workaround

**Current state:** `tool_execution_end` carries no `args` — only
`toolCallId`, `toolName`, `result`, `isError`. `SessionTracker.recordEvent()`
pairs start/end events via a `pendingArgs` map to recover the file path. This
workaround took months to get right (documented in CLAUDE.md traps section).

**With pi-durable:** `hook(ToolTask, { afterTool })` receives the complete
tool call including `args` and the result. No pairing needed.

```typescript
hook(ToolTask, {
    afterTool: (call, result) => {
        if (call.name === "read" && !result.isError) {
            hebbianTracker.trackAccess(call.args.path);
        }
        return undefined;
    },
})
```

**Impact:** Eliminates a fragile workaround and a documented trap. The
Hebbian layer becomes straightforward.

### 3. Declarative hook system

**Current state:** Hooks are chained manually:

```typescript
const originalBefore = session.agent.beforeToolCall;
session.agent.beforeToolCall = async (ctx, signal) => {
    const prior = await originalBefore?.(ctx, signal);
    if (prior?.block) return prior;
    const blocked = await gate.check(ctx.toolCall.name, ctx.args);
    return blocked ?? prior;
};
```

Each hook must save the previous handler and null-check it. Order depends on
installation order. Three hooks (permissions, heading guard, edit recovery)
are installed in `session-boot.ts` with this pattern.

**With pi-durable:** Extensions declare hooks:

```typescript
const Permissions = defineExtension({
    name: "permissions",
    hooks: [
        hook(ToolTask, {
            beforeTool: (call) => {
                if (isDenied(call)) return { block: "Access denied" };
                return undefined;
            },
        }),
    ],
});
```

No chaining, no null-checks, no ordering bugs.

### 4. System prompt caching

**Current state:** `assembleSystemPrompt()` builds the entire prompt once at
session start. `date-guard.ts` refreshes it on day rollover by replacing the
resource loader's override. The entire prompt is re-sent.

**With pi-durable:** `section()` functions render independently. Only changed
sections are re-sent, keeping the provider prompt cache warm.

```typescript
section("identity", (input) => loadSoulPrompt(input.env?.cwd)),
section("user",     (input) => loadUserProfile(input.env?.cwd)),
section("rules",    (input) => loadAgentsRules(input.env?.cwd)),
section("time",     ()      => `Current date: ${new Date().toISOString()}`),
```

The time section changes every request; identity and rules do not. The
provider caches the stable prefix.

### 5. Subagent architecture for consolidation and reflect

**Current state:** Consolidation creates a separate `createAgentSession()`
with its own `ResourceLoader`, `SessionManager`, tools, and prompt. Reflect
uses `child_process.fork()` to spawn a background Node.js process.

**With pi-durable:** Both become conversations:

```typescript
// Consolidation as subagent
const maintenance = await api.commit(async (tx) => {
    const child = await tx.createConversation({
        ownership: { kind: "task", taskId: api.taskId },
    });
    await configure(tx, child.id, {
        model: fastTierModel,
        extensions: { remove: [UserFacing] },
        instructions: maintenancePrompt,
    });
    return child.id;
}, context);

// Reflect as fork
const fork = await root.fork(lastEntryId, {
    ownership: { kind: "ownerless" },
    agent: { model: fastTierModel },
}, context);
```

Subagents are durable: crash → resume. No separate processes.

### 6. Task graph visibility

**Current state:** Buddy has no visibility into what background work is
running. Consolidation state lives in `consolidation-state.json`. The
heartbeat is a `setInterval`. No UI shows whether a reflect or consolidation
is in progress.

**With pi-durable:** `harness.taskGraph(context)` shows every live task:

```typescript
const graph = await harness.taskGraph(context);
graph.subscribe((value) => {
    // value.tasks: all running tasks with status, owner, kind
    renderTaskPanel(value);
});
```

The frontend could show a small indicator: "Consolidation depth-1 running",
"Reflect in progress", etc.

### 7. Typed application state (Documents)

**Current state:** Consolidation state, wiki state, and other operational
state live in JSON files on disk (`consolidation-state.json`,
`wiki-state.json`). Read/write is manual, race conditions are possible.

**With pi-durable:** Documents are typed JSON state committed atomically with
transcript entries:

```typescript
const ConsolidationState = defineDoc<ConsolidationState>({
    kind: "buddy.consolidation",
    version: 1,
    scope: "conversation",
    initial: () => defaultConsolidationState(),
});

await root.commit(async (tx) => {
    const state = await tx.doc(ConsolidationState, root.id);
    state.sessionsSinceLastDepth1++;
}, context);
```

No race conditions. Atomic with the conversation.

---

## Negative Impact

### 1. Rewrite of stable, tested code

Buddy has ~30 completed features with passing BDD scenarios and unit tests.
The migration touches ~5,200 lines of backend code and requires rewriting or
adapting ~10,000 lines of tests. This is real risk of regressions in code
that currently works.

### 2. New dependency chain

pi-durable depends on:
- `@earendil-works/pi-ai` (model access)
- `@earendil-works/chord` (document state management)

Chord is an opaque dependency buddy does not control. Its internal state
format, conflict resolution, and performance characteristics are unknowns.

### 3. Loss of pi-coding-agent conveniences

`createAgentSession()` wires up a lot: resource loading, tool registration,
session management, extensions. pi-durable requires assembling these pieces
manually. The trade-off is more control for more boilerplate.

### 4. Binary size increase

The sidecar binary (Bun compile) currently includes pi-coding-agent and its
transitive dependencies. Adding pi-durable + chord + SQLite native bindings
increases the binary. The README notes TypeBox alone costs ~23 MB RSS
unbundled, ~4 MB bundled.

### 5. SQLite + Bun compile risk

pi-durable's SQLite backend uses `better-sqlite3` or a similar native addon.
Bun's `--compile` has historically struggled with native Node addons. The JSONL
backend is an alternative but loses the atomicity guarantees that make
pi-durable valuable.

### 6. Different event format

`watchEvents()` produces coding-agent-style events (`message_start`,
`message_update`, `tool_execution_start`...) but they are "derived from
commits, one batch per commit." The exact event shapes and timing may differ
from what `session.subscribe()` produces today. Buddy's frontend Svelte
stores (`handleEvent()` in the architecture doc) parse specific event fields
— each one needs verification.

---

## Neutral Impact

### 1. Session persistence format changes

Buddy currently uses JSONL via `SessionManager`. pi-durable offers SQLite
(preferred) or JSONL. Either way, the storage format changes. Existing
session files are not compatible. This is neutral because buddy creates fresh
sessions on every launch — there is no session continuity to preserve.

### 2. Tool definition API changes

Buddy's tools use `ToolDefinition` from pi-coding-agent. pi-durable uses
`defineTool()` with TypeBox schemas. The migration is mechanical: same
description, same handler logic, different wrapper. TypeBox schemas are
slightly more verbose but provide runtime validation.

### 3. Frontend unchanged

The Svelte frontend, kkrpc transport, and Tauri shell are unaffected. The
migration is entirely in the TypeScript worker. The `WorkerAPI` / `FrontendAPI`
contract in `shared/api.ts` stays the same — only its implementation changes.

---

## Dangers

### 1. "Experimental. The API changes without notice between releases."

This is the first line of the pi-durable README. It means:

- Any update to pi-durable may break buddy's code.
- There is no deprecation cycle or migration guide.
- The API surface buddy depends on may be renamed, removed, or restructured.

This is the single largest risk. Building on an experimental API couples
buddy's stability to upstream decisions buddy cannot influence.

### 2. Consolidation runner complexity

`consolidation-runner.ts` is 715 lines — the largest backend file. It
orchestrates cascading depth runs, pre-computed reports (Hebbian, brain
health, upcoming reminders, observations), lock management, post-validation,
and git commits. Migrating this to the subagent pattern requires rethinking
how reports are injected, how locks interact with durable tasks, and how
post-validation runs after the model finishes.

The risk is not that the logic changes — it is that a subtle interaction
between durable task scheduling and buddy's consolidation cascade produces a
bug that only manifests after hours of operation.

### 3. Reflect timing changes

Buddy's reflect currently runs as a detached child process. The app window
closes in <100ms — the user does not wait. With pi-durable, if reflect is a
durable task inside the harness, closing the harness must wait for the task or
persist its state. If the harness is closed too early, the reflect task is
interrupted. If it waits, app close is slow.

The README says a task rerun on reopen only happens when declared
`replay: "safe"`. Reflect reads the conversation and writes to files —
rerunning it after a crash could produce duplicate log entries or observation
duplicates.

### 4. Permission UX interaction

Buddy's permission system is interactive: the tool call blocks while the
frontend shows a dialog and the user clicks Allow/Deny. pi-durable's
`beforeTool` hook can return `{ block: "reason" }`, which gives the model an
error result — but it is not clear whether it supports an async "ask the user
and wait" pattern the way buddy's current `beforeToolCall` hook does.

If `beforeTool` must return synchronously or within a timeout, buddy's
interactive permission model needs a different approach (e.g. a tool that
explicitly asks for permission before proceeding).

### 5. Two-package dependency gap

Buddy currently depends on one Pi package (`pi-coding-agent`). Migrating to
pi-durable means depending on `pi-durable` + `pi-ai` + `chord`, plus
removing `pi-coding-agent`. If pi-durable lags behind pi-ai in a release,
buddy could face version conflicts.

---

## Effort Estimate

| Phase | Scope | Estimate |
|---|---|---|
| Foundation (Harness, storage, tools, sections) | ~2 weeks |
| Hooks and permissions | ~1 week |
| Lifecycle (reflect, consolidation, heartbeat) | ~2-3 weeks |
| Frontend integration (watchEvents, WorkerAPI) | ~1-2 weeks |
| Cleanup and validation | ~1 week |
| **Total** | **~7-9 weeks** |

Test impact: ~10,000 lines of tests need rewriting or adaptation. ~20,000
lines of tests (pure logic) survive unchanged.

---

## Recommendation

**Wait for pi-durable to exit experimental status.** The benefits are real —
crash recovery, clean hooks, durable tasks — but the "API changes without
notice" label means building on it today risks forced rewrites with every
upstream release.

**In the meantime:**

1. **Update to pi-coding-agent v1.0.0** (1-2 days). The breaking changes are
   minor and buddy gains new models, better caching, and bug fixes.

2. **Isolate the coupling.** When new features touch session-boot or
   worker-core, design them so the Pi SDK dependency is behind an interface
   (buddy already does this with `PiSessionLike`). This makes a future
   migration cheaper.

3. **Run a spike when pi-durable stabilizes.** Dedicate 2-3 days to:
   Harness + one tool + one hook + `watchEvents()`, compiled with Bun, to
   validate the event format, SQLite compatibility, and interactive permission
   flow.

4. **Track the pi-durable changelog.** When it drops the "Experimental"
   label or reaches a v2 with stability guarantees, re-evaluate.
