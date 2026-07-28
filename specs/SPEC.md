---
created: 2026-07-19
---

# buddy — Functional & Non-Functional Specification

Source specification for BDD features and acceptance criteria.
References [design principles](app-design-principles.md) for WHY,
[technical spec](app-spec-tauri.md) for HOW. This document defines WHAT.

---

## 1. Product Context

**What:** A native desktop app (macOS + Linux) that gives non-technical users
a personal assistant with persistent, learning memory.

**Who:** People who use ChatGPT but have never used an IDE, terminal, or code
assistant. The first user is someone who wants a second brain they can talk to
— not a developer tool.

**Core promise:** "It remembers." Sessions have continuity. The agent captures,
organizes, and retrieves without the user managing files. Knowledge accumulates
and the assistant improves with use.

**Platform:** Tauri v2 (native shell) + Node.js worker (Pi SDK) + git-backed
markdown file system. macOS primary, Linux supported. No cloud dependency, no
proprietary formats, no telemetry.

---

## 2. Architecture Summary

```
Frontend (Svelte, system webview)
    │ kkrpc (type-safe bidirectional RPC)
    ▼
Node.js Worker (TypeScript)
    ├── Pi SDK: createAgentSession()
    ├── Permission layer (beforeToolCall hook)
    ├── Hebbian tracker (tool_execution_end via session.subscribe)
    ├── Heartbeat scheduler (Phase 2 — setInterval)
    └── Consolidation runner (Phase 2 — separate Pi session)
    │
    ├─── reads ──▶ ~/.buddy/ (global config, core prompts)
    │                ├── config.json (rootDir pointer, language)
    │                ├── auth.json (credentials, mode 600)
    │                ├── allowed-paths.json (Zone 2 paths)
    │                └── prompts/ (app-managed, updatable)
    │                     ├── agents-base.md (universal behavior)
    │                     ├── consolidation.md
    │                     ├── process-conversation.md
    │                     └── triage-inbox.md
    │
    ▼
rootDir (git repo — user/agent content only)
    ├── AGENTS.md (instance-specific behavioral rules)
    ├── agent_brain/ (agent's learned knowledge)
    ├── user/ (user's tasks, drafts, journal)
    ├── logs/ (daily agent logs)
    ├── .pi/settings.json (per-instance provider/model)
    └── .buddy/ (runtime state, gitignored)
         ├── maintenance.lock
         ├── consolidation-state.json
         └── logs/*.jsonl (app events)
```

**Key patterns:**
- `kkrpc` for frontend↔worker communication (type-safe, bidirectional)
- `excludeTools: ["bash"]` — file operations only, no shell
- Hook chaining on `beforeToolCall` for permissions; Hebbian tracking via `tool_execution_end` in `session.subscribe()`
- `DefaultResourceLoader` with assembled system prompt at session start
- **Skill tools** (FR-SKILL): procedural prompts from `~/.buddy/prompts/` registered as custom tools — the LLM invokes them when needed, worker returns prompt text
- Separate Pi session for maintenance (consolidation never touches live session)
- **Global/local split:** Core app assets (`~/.buddy/prompts/`) are app-managed and updatable; `rootDir` contains only instance-specific content owned by user/agent (NFR-PORT-05)

---

## 3. Functional Requirements

### 3.1 Chat (FR-CHAT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-CHAT-01 | Streaming message display | 0 ✓ |
| FR-CHAT-02 | User input with send | 0 ✓ |
| FR-CHAT-03 | Abort generation | 0 ✓ |
| FR-CHAT-04 | Markdown rendering in assistant messages | 3 ✓ |
| FR-CHAT-05 | Thinking block display (transient indicator) | 3 ✓ |
| FR-CHAT-06 | Tool call display (expandable cards) | 3 ✓ |
| FR-CHAT-07 | Auto-scroll with manual override | 0 ✓ |
| FR-CHAT-08 | Input textarea resets height after send | 2 ✓ |
| FR-CHAT-09 | Local file links are marked and routed internally | 2 ✓ |
| FR-CHAT-10 | Inline file viewer for markdown/text links | 2 ✓ |
| FR-CHAT-11 | Local links are view-only, internal, and scoped | 3 |
| FR-CHAT-12 | Navigation inside the inline viewer | 2 |

**FR-CHAT-01 — Streaming message display**

- **Given** the user has sent a message
- **When** the agent begins responding
- **Then** text appears token-by-token as `message_update` events arrive
- **And** a typing indicator is visible until `agent_end`

**FR-CHAT-02 — User input with send**

- **Given** the chat view is active and no response is streaming
- **When** the user types text and presses Enter
- **Then** the message appears as a user bubble, input clears, and the agent begins processing
- **And** Shift+Enter inserts a newline without sending

**FR-CHAT-03 — Abort generation**

- **Given** the agent is streaming a response
- **When** the user clicks Abort or presses Escape
- **Then** generation stops, partial response remains visible, and input re-enables

**FR-CHAT-04 — Markdown rendering**

- **Given** the agent sends a response containing markdown
- **When** the message renders
- **Then** headings, bold, italic, lists, links, and fenced code blocks with syntax highlighting render correctly

**FR-CHAT-05 — Thinking block display**

- **Given** the agent response includes thinking content (`thinking_delta` events)
- **When** the message renders
- **Then** during streaming: thinking-only bubbles show a transient "Pensando…" indicator
- **And** after the turn completes: thinking-only bubbles (no text content) are hidden entirely
- **And** thinking text is never shown to the user after the turn ends (no stale indicators)

**FR-CHAT-06 — Tool call display**

- **Given** the agent executes tool calls during a response
- **When** tool events arrive (`tool_execution_start`, `tool_execution_end`)
- **Then** during streaming: each active tool call appears as an expandable card showing tool name and status
- **And** after the turn completes: the tool activity indicator is hidden (transient UX, not permanent record)

**FR-CHAT-07 — Auto-scroll with manual override**

- **Given** new content is streaming into the chat
- **When** the user has NOT scrolled up
- **Then** the view auto-scrolls to the latest content
- **But when** the user has scrolled up manually
- **Then** auto-scroll pauses and a "scroll to bottom" button appears

**FR-CHAT-08 — Input textarea resets height after send**

- **Given** the user has typed a multiline message (textarea auto-grew)
- **When** the message is sent and the input clears
- **Then** the textarea height resets to its single-line default
- **And** subsequent messages start with the compact input bar

**FR-CHAT-09 — Local file links are marked and routed internally**

- **Given** the agent response contains a markdown link to a local file (relative path without `://` protocol, e.g. `[name](agent_brain/skills/foo.md)`)
- **When** the link renders in the chat
- **Then** it is marked with a `data-local-path` attribute (no `target="_blank"`)
- **And** clicking it is handled inside Buddy — never by an external program (see FR-CHAT-11)
- **And** external URLs (`http://`, `https://`) continue to open in the browser as before
- **Note:** The renderer in `src/lib/markdown.ts` must distinguish local paths from external URLs. A path is local if it has no protocol prefix or uses `file://`.
- **Changed (Jul 27):** the original acceptance criterion delegated the click to
  `tauri-plugin-opener` `openPath()`. That behavior is withdrawn — see FR-CHAT-11.

**FR-CHAT-10 — Inline file viewer for markdown/text links**

- **Given** the user clicks a local file link that resolves to a viewable file (FR-CHAT-11)
- **When** the file exists and is readable
- **Then** a read-only panel/modal opens inside Buddy showing the file content rendered as markdown (for `.md`) or plain text (for `.txt`)
- **And** the panel includes a "Close" button
- **And** the panel has **no** "Open externally" affordance (withdrawn, FR-CHAT-11)
- **And** the file content is read by the worker, not by the frontend (NFR-SEC-09)
- **But when** the file cannot be read
- **Then** the panel shows a plain-language error instead of content

**FR-CHAT-11 — Local links are view-only, internal, and scoped**

Supersedes the system-opener behavior originally specified in FR-CHAT-09/10.

- **Given** the user clicks a local file link emitted by the agent
- **When** the target is a `.md` or `.txt` file inside the buddy directory, under
  `agent_brain/`, `user/`, `downloads/` or `logs/`
- **Then** it opens in the inline viewer (FR-CHAT-10)
- **But when** the target is any other file type (`.pdf`, `.png`, `.command`, …)
- **Then** it is **not** clickable; the path renders as plain text so the user can
  locate it with their own file manager
- **And when** the target resolves outside the buddy directory, or outside the four
  allowed directories — including via `..` segments — it is rejected the same way
- **And** Buddy **never** opens a file with an external program. There is no
  "open externally" action anywhere in the product.
- **Note (do not "fix" this):** an exception for directories is unsafe. On macOS an
  application bundle (`.app`, `.pkg`) *is* a directory, so an `isDirectory()` check
  would re-open the execution path this requirement exists to close.
- **Rationale:** the agent authors these links, and the agent ingests untrusted web
  content via `fetch_url`. A link is therefore attacker-influenced input, not a
  user intention. Viewing is safe; launching a program is not.

**FR-CHAT-12 — Navigation inside the inline viewer**

- **Given** a document open in the inline viewer contains markdown links
- **When** the user clicks one
- **Then** the viewer navigates to that document, applying the same rules as
  FR-CHAT-11: viewable type, inside the buddy directory, under one of the four
  user-facing directories
- **And** the link is resolved **relative to the directory of the document being
  viewed**, not relative to the buddy root
- **And** a link that resolves outside those bounds is not followed
- **And** the user can go back through the documents visited in this viewing
  session, and the viewer reports where they are
- **Rationale:** links inside a document are written relative to it — a wiki page
  at `user/wiki/topic/page.md` links to `sibling.md` and
  `../other-topic/page.md`. Resolving those against the buddy root would reject
  every one of them. Without back navigation, following a link is a trap: the
  user reaches a page with no way to return to the one the assistant cited.
- **Note:** this is not wiki-specific. It applies to any internal document with
  links; FR-WIKI-01..04 will simply make it the common case.

### 3.2 First-Run / Onboarding (FR-SETUP)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SETUP-01 | First-run detection | 1 ✓ |
| FR-SETUP-02 | Language selection | 1 ✓ |
| FR-SETUP-03 | Welcome screen | 1 ✓ |
| FR-SETUP-04 | Location picker | 1 ✓ |
| FR-SETUP-05 | Provider authentication | 1 ✓ |
| FR-SETUP-06 | Model selection | 1 ✓ |
| FR-SETUP-07 | Personalization form (name + about) | 1 ✓ |
| FR-SETUP-08 | Deterministic buddy directory setup | 1 ✓ |
| FR-SETUP-09 | First conversation with warm handoff | 1 ✓ |
| FR-SETUP-10 | Import existing instance | 1 ✓ |
| FR-SETUP-11 | Worker validates the location before creating or adopting | 2 |
| FR-SETUP-12 | Incomplete instances are detected, not adopted | 2 |

**FR-SETUP-01 — First-run detection**

- **Given** the app launches
- **When** no buddy directory is configured in `~/.buddy/config.json`
- **Then** the setup wizard is shown instead of the chat view

**FR-SETUP-02 — Language selection**

- **Given** the setup wizard starts
- **When** the user selects their preferred language
- **Then** the entire wizard UI switches to that language
- **And** the language is stored and used for all subsequent UI and agent replies

**FR-SETUP-03 — Welcome screen**

- **Given** the user has selected a language
- **When** the welcome step loads (in the user's language)
- **Then** a brief explanation of what buddy is and what it does is shown
- **And** a "Continue" button proceeds to the next step

**FR-SETUP-04 — Location picker**

- **Given** the user is on the location step of the wizard
- **When** they accept the default (`~/buddy`), type a custom path, or use the native "Browse" button
- **Then** a native directory picker dialog opens (via `tauri-plugin-dialog`) on Browse, or the typed path is used directly
- **And** the path is validated (doesn't exist or is empty) and stored

**FR-SETUP-05 — Provider authentication**

- **Given** the user is on the provider step
- **When** they select a provider (Anthropic, OpenAI, or Google)
- **Then** an OAuth "Sign in" button appears as the primary option
- **And** an "I have an API key" link shows the key input as a secondary option
- **And (OAuth path)** clicking "Sign in" opens the browser for OAuth authentication
- **And (OAuth path)** tokens are stored in `~/.buddy/auth.json` upon successful login
- **And (API key path)** the key is validated with a test API call before proceeding
- **And (API key path)** the key is stored in `~/.buddy/auth.json` with restrictive file permissions
- **Note:** OpenAI-compatible (custom) providers are available post-setup via Settings → Add provider, not in the setup wizard.

**FR-SETUP-06 — Model selection**

- **Given** the user has authenticated with a provider
- **When** the model selection step loads
- **Then** available models for that provider are listed with a recommended default
- **And** brief cost/capability descriptions are shown per tier

**FR-SETUP-07 — Personalization form**

- **Given** the user is on the personalization step
- **When** the form loads
- **Then** a brief explanation states why this matters ("your assistant will be more useful from the start")
- **And** two fields are shown: Name (required, "How should I address you?") and About (optional, "Tell me about yourself — the more, the better")
- **And** the user can continue with only a name, or add as much context as they want

**FR-SETUP-08 — Deterministic buddy directory setup**

- **Given** the user completes the wizard form
- **When** setup runs
- **Then** the full directory structure is created (`agent_brain/`, `user/`, `logs/`)
- **And** templates are copied and USER.md is populated with the name (and About if provided) — no placeholders remain
- **And** `agent_brain/skills/` is created with `.gitkeep` only — core procedural skills are **not** copied into the instance; they live in `~/.buddy/prompts/` (FR-SKILL-01)
- **And** Pi settings are written (`.pi/settings.json`) with the selected provider/model
- **And** git is initialized with an initial commit
- **And** no LLM call is made during this phase

**FR-SETUP-09 — First conversation with warm handoff**

- **Given** the buddy directory is created and configured
- **When** the first session starts
- **Then** the user's personalization data (name, about) is injected as an initial user message to the agent (not shown in the UI) so the agent already knows who they are
- **And** the agent's first visible response is a warm welcome by name, with brief tips on how to use it
- **And** during this first conversation, identity file writes (USER.md) do NOT trigger permission prompts — the agent is expected to enrich the profile
- **And** from the second session onward, normal permission rules apply

**FR-SETUP-10 — Import existing instance**

- **Given** the location picker step shows an existing buddy directory (one with `agent_brain/`)
- **When** the user confirms import
- **Then** the app verifies auth credentials exist for the detected provider (`getAuthStatus()`)
- **And** if auth is valid, the directory is adopted without modifying its content
- **But when** auth is missing (e.g. `~/.buddy/auth.json` deleted), the wizard routes to the provider step with the instance's provider/model pre-selected for re-authentication
- **And** platform artifacts (`.cursor/`, `.codex/`) are ignored
- **And** the wizard skips personalization (existing instance already has data)

**FR-SETUP-11 — Worker validates the location before creating or adopting**

- **Given** `runSetup` receives a `rootDir`
- **When** mode is `create`
- **Then** the worker re-runs `validateLocation` and proceeds only for `ok-new`
  or `ok-empty`, refusing with a plain-language error otherwise
- **And when** mode is `import`
- **Then** the worker proceeds only for `existing-buddy`
- **Rationale:** the wizard already gates on this (`setup-controller.ts`), but
  the worker trusts whatever path arrives. That is the shape NFR-SEC-08 exists
  to prevent — the frontend decides what to *offer*, the worker decides what is
  *allowed*. The failure if a path slips through is not subtle: `cpSync` runs
  with `force: true`, then `git init` and `git add .` execute inside a directory
  full of the user's own files.

**FR-SETUP-12 — Incomplete instances are detected, not adopted**

- **Given** a directory containing `agent_brain/`
- **When** it is evaluated for import
- **Then** completeness is checked — the core brain files and a git repository —
  and an instance missing them is reported as incomplete rather than offered for
  adoption
- **Rationale:** `createBuddyInstance` is not atomic. A setup that fails after
  copying templates but before `markConfigured` leaves `agent_brain/` on disk
  with no git repo, and `validateLocation` only tests for that one directory. On
  the next launch the wizard therefore offers to *import* the wreckage of the
  previous attempt. Adoption succeeds, and every auto-commit fails from then on
   — surfacing eventually as "maintenance paused" (FR-CONSOL-09), a message with
  no relation to the actual cause.

**Note:** Prerequisites (git installed) are checked as a gate before the wizard
proceeds past the language step. If git is missing, a clear message with
platform-specific install instructions is shown and setup cannot continue.

### 3.3 Session Management (FR-SESSION)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SESSION-01 | Fresh session on every launch | 1 ✓ |
| FR-SESSION-02 | (removed — every launch is inherently fresh) | — |
| FR-SESSION-03 | Session end on app close | 1 ✓ |

**FR-SESSION-01 — Fresh session on every launch**

- **Given** the app starts and a configured buddy directory exists
- **When** the worker initializes
- **Then** a new Pi session is created via `SessionManager.create()`
- **And** continuity comes from the system prompt (identity and rules) plus a session-start context message (logs, deferred) — not from prior chat history
- **And** no prior conversation history is carried over (memory is in files, not chat context)

**FR-SESSION-02** — *(removed: with fresh sessions on every launch, there is no
"current session" to end and no separate "new session" action needed)*

**FR-SESSION-03 — Session end on app close**

- **Given** the user closes the app window or quits
- **When** the shutdown sequence runs
- **Then** session metadata (sessionId, start/end times, calendar date) is passed to the reflect child via spawn args
- **And** a background reflect child is spawned with the forked session file (FR-REFLECT-02)

### 3.4 Reflect (FR-REFLECT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-REFLECT-01 | Session-end reflect finalization (daily log append) | 1 ✓ |
| FR-REFLECT-02 | Forked reflect on session end (primary) | 1 ✓ |
| FR-REFLECT-03 | Compaction-triggered checkpoint reflect (fork before Pi compacts) | 2 ✓ |
| FR-REFLECT-04 | Log output sanitizer (strip tool-call artifacts) | 2 ✓ |
| FR-REFLECT-05 | Session path persistence and crash recovery | 2 ✓ |
| FR-REFLECT-06 | Reflect child does not race the worker for the git index | 2 |
| FR-REFLECT-07 | Reflect child is bounded by a timeout | 2 |

**FR-REFLECT-01 — Session-end reflect finalization**

- **Given** a session-end reflect child completes its LLM call
- **When** the child finalizes output
- **Then** a `## Session HH:MM–HH:MM` block is appended to `logs/YYYY-MM-DD.md` using session metadata passed via spawn args (sessionDate, sessionStart, sessionEnd)
- **And** `logs/index.md` is rebuilt from daily log frontmatter
- **And** the app commits all changes (`buddy: session reflect`)
- **Note:** Session metadata (date, header times, sessionId) is passed as spawn args — no intermediate pending file.

**FR-REFLECT-02 — Forked reflect on session end (primary path)**

- **Given** a session ends normally (user closes app or ends session)
- **When** the shutdown sequence runs
- **Then** the reflect child forks the live session via `SessionManager.forkFrom(sessionFile, rootDir, forkDir)` — creating a new JSONL with full conversation context in `.buddy/reflect-sessions/`
- **And** a background process is spawned to run the LLM reflect independently of the app window (dev: `child_process.fork()`; production: `spawn(execPath, ["--reflect", ...])` — see E13b)
- **And** the app window closes immediately (<100ms total shutdown time)
- **And** the background process: opens the forked session → sends a single user prompt asking for the reflect (Decisions, Lessons, Context, Open threads, Tasks captured, Ideas, System observations) → commits agent file writes immediately → appends a `## Session HH:MM–HH:MM` block to `logs/YYYY-MM-DD.md` (session start date, local calendar day) → rebuilds `logs/index.md` → commits → exits
- **Design principle — fork-only context:** The forked session already contains the full conversation (all user/assistant turns, tool calls, tool results). The reflect child does NOT load a system prompt, AGENTS.md, identity files, or resource loader — those weren't part of the session and would pollute the context. The only input is a user prompt requesting the structured reflect. Session metadata (date, header) comes from spawn args, not from any intermediate file.

**FR-REFLECT-03 — Compaction-triggered checkpoint reflect (fork before Pi compacts)**

- **Given** Pi emits a `compaction_start` event (context window about to be compressed)
- **When** the worker receives the event (and there has been activity since the last checkpoint)
- **Then** the worker forks the current session file **before** Pi runs compaction and spawns a background child process with mode `checkpoint`
- **And** Pi's compaction proceeds normally afterward (2 LLM calls per compaction: reflect fork + Pi summary)
- **And** the child opens the forked session and sends a single user prompt requesting a lightweight encode (Context + Notes sections only) — no system prompt override, no resource loader
- **And** the child appends a `## Checkpoint HH:MM` block to `logs/YYYY-MM-DD.md` (session start date) using a fast-tier model
- **And** the user's conversation is never interrupted
- **And** the session-end reflect (FR-REFLECT-02) produces the comprehensive `## Session HH:MM–HH:MM` entry covering the final segment since the last checkpoint
- **Note:** This is the **sole** mid-session reflect trigger. Turn-count checkpoints (`INCREMENTAL_REFLECT_EVERY`) are removed — fork capability makes periodic encoding unnecessary except when context is at risk of loss. The fork happens BEFORE compaction so the reflect has access to full conversation detail that Pi's summary may omit. Mid-session checkpoint output is committed to the daily log and queryable by the agent during the same session.

**FR-REFLECT-05 — Session path persistence and crash recovery**

- **Given** a new Pi session is created on app launch
- **When** `SessionManager.create(cwd)` succeeds
- **Then** the worker writes the session file path to `.buddy/consolidation-state.json` immediately (zero LLM cost)
- **And** the heartbeat may update a last-known timestamp for diagnostics (optional)
- **Given** the app starts and a stale session is detected (persisted path exists but no reflect completed for that session)
- **When** boot recovery runs before creating a new live session
- **Then** the worker forks from the persisted session path and spawns a reflect child (same fork-only pattern as FR-REFLECT-02)
- **And** after reflect completes (or is skipped if fork unavailable), normal session creation proceeds
- **Note:** Effective loss window is crash before first disk write (~milliseconds), not 30 minutes. Pre-consolidation: when consolidation is due, reflect the pending session first so the daily log is current, then run the consolidation cascade.

**FR-REFLECT-06 — Reflect child does not race the worker for the git index**

- **Given** the reflect child commits the agent's writes
- **When** the main worker or a consolidation run commits at the same moment
- **Then** the two do not compete for `.git/index.lock`; git access is serialized
- **And** a commit that cannot proceed is retried rather than propagating as a fatal error
- **Found (Jul 27):** the child's first `commitAll` runs *before* it takes the
  maintenance lock, which only protects finalization. The worker auto-commits
  after agent writes on its own schedule. When they collide, the loser throws,
  the child exits non-zero, and **the whole reflect is lost** — the session
  summary along with it. This is silent memory loss with no attacker involved,
  the failure this product can least afford.

**FR-REFLECT-07 — Reflect child is bounded by a timeout**

- **Given** a reflect child has been spawned detached and unref'd
- **When** its LLM call or model lookup does not return
- **Then** the child aborts after a bounded interval, logs the reason and exits
- **Rationale:** the child outlives the app by design, so nothing supervises it.
  A stalled provider leaves a process running indefinitely after the user has
  closed Buddy, and nothing sends the `SIGTERM` its handler waits for. Combined
  with unpruned forks (NFR-MAINT-02), both files and processes accumulate.

**Reflect architecture summary:**

```
Normal shutdown:
  app (sync, <100ms): fork session file → spawn child with metadata args → close
  child (async):      open fork → user prompt only (no sys prompt/resources) → LLM reflect → commit agent writes → append ## Session to daily log → commit → exit

Crash recovery (boot):
  worker:             detect stale session in consolidation-state.json → fork → reflect child → then create new session

Pre-consolidation:
  worker:             if session has unreflected activity → fork reflect → wait → then cascade consolidation

Mid-session (compaction_start only):
  worker (sync):      fork session file → spawn child (checkpoint) → Pi compacts in parallel
  child (async):      open fork → user prompt only → lightweight LLM → append ## Checkpoint to daily log → commit → exit

Spawn mechanism:
  dev:  child_process.fork(reflect-child.ts) with tsx
  prod: spawn(process.execPath, ["--reflect", ...]) — same binary, argv dispatch (E13b)

Fork bomb defense:
  1. argv.includes("--reflect") — robust parsing regardless of Bun argv structure
  2. BUDDY_REFLECT_CHILD=1 env var — child env marker for recursion guard (legacy: AB_REFLECT_CHILD)
```

**FR-REFLECT-04 — Log output sanitizer (strip tool-call artifacts)**

- **Given** the reflect process writes a session block to the daily log
- **When** the output contains raw tool-call syntax leaked from the model (e.g. `to=functions.read code:` followed by JSON)
- **Then** those lines are stripped before writing to the log file
- **When** the LLM output includes a leading `## Session` or `## Checkpoint` header (worker adds the correct header from spawn args)
- **Then** that header is stripped before append — the daily log contains exactly one session heading per reflect finalization
- **When** the LLM output uses `##` for content sections (Context, Decisions, Lessons, etc.)
- **Then** those headings are normalized to `###` (h3) before append — session blocks use `## Session` only from worker metadata
- **Note:** This is a cosmetic guard against LLM output corruption — the model occasionally emits tool invocation syntax as plain text instead of executing it. The sanitizer runs on the final text before file write.

### 3.5 Permission Layer (FR-PERM)

| ID | Description | Phase |
|----|-------------|-------|
| FR-PERM-01 | Zone 1: buddy home full access | 1 ✓ |
| FR-PERM-02 | Identity file write confirmation | 1 ✓ |
| FR-PERM-03 | Zone 3: confirm all outside access | 1 ✓ |
| FR-PERM-04 | Hardcoded denylist | 1 ✓ |
| FR-PERM-05 | Implicit permission from user messages | rejected |
| FR-PERM-06 | Zone 2: user-designated paths | 1 ✓ |
| FR-PERM-07 | Permission prompt in chat | 1 ✓ |

**FR-PERM-01 — Zone 1: buddy home**

- **Given** the agent calls a file tool on a path inside the buddy directory
- **When** the path is not an identity file or blocked write target
- **Then** the operation is allowed silently (no user prompt)

**FR-PERM-02 — Identity file write confirmation**

- **Given** the agent attempts to write to `SOUL.md`
- **When** the permission layer intercepts the write
- **Then** the user is asked for confirmation in the chat before the write proceeds
- **Note:** `USER.md` writes are allowed silently (same as Zone 1). The agent
  manages user profile data as part of normal operation. Only `SOUL.md` (the
  agent's own identity/character) requires confirmation. During the first
  session (FR-SETUP-09), even SOUL.md writes are allowed without prompting.

**FR-PERM-03 — Zone 3: outside access**

- **Given** the agent calls a file tool on a path outside the buddy directory
- **When** the path is not on the denylist
- **Then** the user is shown a permission prompt with options (allow once, deny)
- **And** the agent pauses on that tool call until the user responds

**FR-PERM-04 — Hardcoded denylist**

- **Given** the agent attempts to access `~/.ssh/*`, `~/.gnupg/*`, `~/.aws/*`, `**/.env`, or `**/auth.json`
- **When** the permission layer evaluates the path
- **Then** access is denied silently — no user prompt, no override possible

**FR-PERM-05 — Implicit permission from messages** *(rejected)*

- **Rejected (2026-07-26):** Not a realistic use case for non-technical users. The permission prompt serves as a double-check if the user writes a wrong path — removing it loses valuable safety signal. Drag & drop (FR-INGEST-03) and Zone 2 "Allow always" (FR-PERM-06) cover the legitimate use cases without ambient parsing.

**FR-PERM-06 — Zone 2: user-designated paths**

- **Given** the user has chosen "Allow always" for a path
- **When** the agent reads from that directory in future sessions
- **Then** read access is granted silently
- **And** write access still requires per-operation confirmation

**FR-PERM-07 — Permission prompt in chat**

- **Given** a permission check requires user input
- **When** the prompt appears
- **Then** it shows the operation (read/write), the path, and action buttons
- **And** the rest of the UI remains interactive while the agent waits

### 3.6 File Ingest (FR-INGEST)

| ID | Description | Phase |
|----|-------------|-------|
| FR-INGEST-01 | Drag and drop files onto chat | 1 ✓ |
| FR-INGEST-02 | Attach button | 1 ✓ |
| FR-INGEST-03 | Dropped file implicit permission | 1 ✓ |
| FR-INGEST-04 | Supported formats | 1 ✓ |
| FR-INGEST-05 | Image attachments (vision) | 1 ✓ |
| FR-INGEST-06 | PDF attachments (local text extraction) | 1 ✓ |

**FR-INGEST-01 — Drag and drop**

- **Given** the chat view is active
- **When** the user drags a file onto the window
- **Then** a visual drop indicator appears
- **And** on drop, the file shows as an attachment chip in the input bar

**FR-INGEST-02 — Attach button**

- **Given** the input bar is visible
- **When** the user clicks the attach button
- **Then** a native file picker opens
- **And** selected files appear as attachment chips in the input bar

**FR-INGEST-03 — Dropped file implicit permission**

- **Given** the user drops or attaches a file
- **When** the message is sent
- **Then** the file path is added to session-allowed paths (read permission granted)
- **And** the prompt context includes the attached path so the agent knows to read it

**FR-INGEST-04 — Supported formats**

- **Given** the user attaches a file
- **When** it is markdown, plain text, or extensionless
- **Then** the agent reads and discusses it normally
- **But when** it is DOCX or another unsupported format
- **Then** a friendly message suggests exporting to text
- **Note:** PDF is supported via local text extraction (FR-INGEST-06); `.pdf` is accepted and its text is injected into the prompt.

**FR-INGEST-05 — Image attachments (vision)**

- **Given** the user attaches a .png, .jpg, .jpeg, .gif, or .webp file
- **When** the message is sent
- **Then** the image is read as base64 and passed to Pi via `PromptOptions.images` as `ImageContent`
- **And** the agent can see and discuss the image contents (multimodal vision)
- **Note:** No file-read tool call is needed — the image is delivered inline in the prompt context. All standard models (Claude, GPT, Gemini) support vision.

**FR-INGEST-06 — PDF attachments**

- **Given** the user attaches a .pdf file
- **When** the message is sent
- **Then** the PDF text is extracted locally and injected into the prompt as text content
- **And** the agent can read and discuss the document contents
- **Implementation:** Local text extraction via `pdf-parse` (`pdfjs-dist` backend). Read PDF → extract text → inject as `<document name="filename.pdf">\n{text}\n</document>` in the prompt text. Format gate in `isSupportedIngestFormat` accepts `.pdf`; the file is never sent as `ImageContent`. Works with any provider/model. If extraction fails, falls back to `User attached: /path.pdf` so the agent can try its read tool.
- **Compiled binary:** `pdfjs-dist` requires `pdf.worker.mjs` on the real filesystem at runtime. In dev, Node.js resolves it from `node_modules/`. In the bun-compiled sidecar, the worker is embedded at build time via `generate-embedded-assets.ts` → `EMBEDDED_PDF_WORKER`. `backends/pdf-extract.ts` writes it to `$TMPDIR/buddy-pdf-worker.mjs` on first use and sets `GlobalWorkerOptions.workerSrc`. DOMMatrix/ImageData/Path2D polyfills in `sidecar-entry.ts` prevent pdfjs module-load crashes.
- **Background (Jul 2026):** Pi SDK has no native PDF support — passing PDFs as `ImageContent` fails silently on OpenAI and would fail on other providers. Native provider PDF APIs are not used; extraction happens in the worker before `session.prompt()`.

### 3.7 Deferred Queue (FR-DEFERRED)

| ID | Description | Phase |
|----|-------------|-------|
| FR-DEFERRED-01 | Surface due items on app start | 1 ✓ |
| FR-DEFERRED-02 | Heartbeat periodic check | 2 ✓ |
| FR-DEFERRED-03 | OS notification for due items | 2 ✓ |

**FR-DEFERRED-01 — Surface on start**

- **Given** `agent_brain/deferred.md` contains items with dates
- **When** the app starts
- **Then** due and overdue items are parsed and included in the session-start context message (FR-PROMPT-02)
- **And** the agent is aware of them from the first message
- **And** a welcome banner card shows the items visually (type, due/overdue badge, text)
- **And** the card is dismissed on the first user message or manually via close button
- **And** when no deferred items are due, a simple greeting is shown instead
- **Language exception:** Deferred item text is written in the **user's language** (from `USER.md` → Preferences), not English. These are messages *to* the user (banner, OS notification), not agent knowledge. All other `agent_brain/` content stays English for cross-tool portability.

**FR-DEFERRED-02 — Heartbeat check**

- **Given** the heartbeat scheduler is running (default: every 30 minutes)
- **When** a tick fires
- **Then** `deferred.md` is parsed and due items are detected
- **And** the frontend is notified via `onDeferredDue()`
- **Resilience:** A 5-second minimum gap rate limiter guards against runaway timer behavior in compiled binaries (where `setInterval` can fire at sub-second intervals if its argument resolves to 0/NaN). Each tick emits a `heartbeat_tick` JSONL event for observability.

**FR-DEFERRED-03 — OS notification**

- **Given** the heartbeat detects due deferred items
- **When** the frontend receives the notification
- **Then** an OS-level notification fires via `tauri-plugin-notification`
- **And** the notification body shows the actual reminder text (single item) or first item + count (multiple items)
- **And** the deferred banner re-shows inside the app so the user sees the items whether they arrive via notification or are already in the app
- **And** the user can dismiss the banner, which removes the items from `deferred.md`
- **Resilience:** A concurrency guard (`notifyInFlight`) prevents multiple simultaneous notification attempts when heartbeat ticks arrive faster than the async notification call resolves. Permission is requested proactively at app start.

### 3.8 Consolidation (FR-CONSOL)

| ID | Description | Phase |
|----|-------------|-------|
| FR-CONSOL-01 | Usage-based trigger evaluation | 2 ✓ |
| FR-CONSOL-02 | Cascade ordering | 2 ✓ |
| FR-CONSOL-03 | Separate maintenance session | 2 ✓ |
| FR-CONSOL-04 | Lock management | 2 ✓ |
| FR-CONSOL-05 | Idle-aware scheduling | 2 ✓ |
| FR-CONSOL-06 | Run journal | 2 ✓ |
| FR-CONSOL-07 | Consolidation relocate tool for brain file grouping | 2 ✓ |
| FR-CONSOL-08 | Consolidation state persisted per completed depth | 2 |
| FR-CONSOL-09 | Failure backoff and retry ceiling | 2 |
| FR-CONSOL-10 | Maintenance session enforces the zone model | 2 |
| FR-CONSOL-11 | Identity changes made by consolidation are surfaced | 2 |

**Consolidation depths:**

| Depth | Name | Trigger | Input | Output |
|-------|------|---------|-------|--------|
| 1 | Daily synthesis | N sessions since last depth-1 (default 3) | Daily log (`logs/YYYY-MM-DD.md`) with raw session blocks | Day summary + journal + inbox triage + knowledge extraction. No file merge needed — daily log already exists. |
| 2 | Weekly calibration | N depth-1 runs since last depth-2 (default 5) | Daily logs from the week | Pattern extraction, observation updates, active-context reconciliation |
| 3 | Monthly pruning | N depth-2 runs since last depth-3 (default 3) | Weekly summaries + knowledge files | Stale observation cleanup, idea/concept promotion/demotion, archive candidates |

**Why daily-append:** Reflect writes session blocks directly to `logs/YYYY-MM-DD.md` at session end (one file per calendar day, multiple `## Session` blocks). Consolidation enriches that file — it does not merge separate session files. `logs/archive/YYYY-MM/` holds **old daily files** after log rotation (28+ daily logs in root), not per-session cleanup.

**FR-CONSOL-01 — Usage-based triggers**

- **Given** sessions have completed since the last consolidation
- **When** the heartbeat evaluates counters (sessions since last depth-1, depth-1 runs since last depth-2, etc.)
- **And** thresholds are met and new content exists (verified via `git diff`)
- **Then** consolidation is triggered at the appropriate depth
- **And** if the current session has unreflected activity, a reflect runs first (FR-REFLECT-05) so the daily log is current before the maintenance session starts
- **Depth-1 session threshold:** fires when `sessionsSinceLastDepth1 >= 3` (default)
- **Depth-1 time threshold:** fires when `sessionsSinceLastDepth1 > 0`, `lastDepth1` is set (at least one prior consolidation), and ≥24h have elapsed since `lastDepth1`
- **Fresh instance guard:** when `lastDepth1` is null (never consolidated), the time threshold does **not** apply — first consolidation requires the session-count threshold only

**FR-CONSOL-02 — Cascade ordering**

- **Given** depth-2 consolidation is due
- **When** depth-1 has not been run since the last depth-2
- **Then** depth-1 runs first, then depth-2
- **And** each depth's counters advance only after successful completion

**FR-CONSOL-03 — Separate maintenance session**

- **Given** consolidation is triggered
- **When** the runner executes
- **Then** a separate Pi session is created (never the user's live session)
- **And** the maintenance session is disposed after completion
- **And** all LLM file writes, log rotation, maintenance log entry, and state updates are committed in **one** git commit per consolidation cycle (message from highest completed depth: `daily:`, `weekly:`, or `monthly:`)

**FR-CONSOL-04 — Lock management**

- **Given** a consolidation is about to run
- **When** the runner attempts to acquire `maintenance.lock`
- **Then** if the lock is held by another process, the run defers
- **And** stale locks (process dead or >1 hour old) are automatically broken

**FR-CONSOL-05 — Idle-aware scheduling**

- **Given** the heartbeat determines consolidation is due
- **When** the user is actively streaming (`session.isStreaming === true`)
- **Then** consolidation defers until the next heartbeat tick

**FR-CONSOL-06 — Run journal**

- **Given** a consolidation run completes (success or failure)
- **When** the result is recorded
- **Then** an entry is appended to `.buddy/consolidation-log.json` with timestamp, depth, duration, and status

**FR-CONSOL-07 — Consolidation relocate tool**

- **Given** a consolidation session is running at depth 3
- **When** the LLM calls `relocate_brain_file` with source `agent_brain/concepts/foo.md` and destination `agent_brain/concepts/cluster/foo.md`
- **Then** the file is moved via `git mv` (preserving history)
- **And** the destination directory is created if absent
- **And** all markdown files referencing the old relative path are updated
- **And** the operation fails gracefully if source is outside `agent_brain/`

**FR-CONSOL-08 — Consolidation state persisted per completed depth**

- **Given** a cascade is running (e.g. target depth 2, so depths 1 and 2 run in order)
- **When** depth 1 completes successfully
- **Then** the advanced counters are written to `.buddy/consolidation-state.json` immediately
- **And when** a later depth in the same cascade fails
- **Then** the work already completed and paid for is not discarded — depth 1 is not re-run on the next evaluation
- **Rationale:** state was previously saved only after the whole loop, so a failure at depth N silently threw away every depth below it. Each depth is an LLM call with real cost.

**FR-CONSOL-09 — Failure backoff and retry ceiling**

- **Given** a consolidation depth has failed
- **When** the failure is recorded
- **Then** the consecutive-failure count for that depth is persisted in `.buddy/consolidation-state.json`
- **And** the next attempt is delayed by an exponential backoff derived from that count
- **And when** the count reaches the ceiling (default 3)
- **Then** consolidation for that depth is abandoned and the user is told, in plain language, that background maintenance is paused and why
- **And** a successful run resets the count to zero
- **Rationale:** without this, a deterministic failure retries every heartbeat tick (30 min) indefinitely, each retry costing a full LLM call. See NFR-REL-04 (amended).

**FR-CONSOL-10 — Maintenance session enforces the zone model**

- **Given** a consolidation session is created
- **When** it makes a file tool call
- **Then** the same permission gate used by the chat session evaluates it
- **And** denylist paths (`~/.ssh/`, `~/.gnupg/`, `~/.aws/`, `**/.env`, `**/auth.json`)
  and `.pi/settings.json` are blocked, as NFR-SEC-02 and NFR-SEC-04 already require
- **And** because no user is present to answer, decisions of kind `outside` are
  resolved as **denial**, recorded in the run journal rather than silently dropped
- **But** decisions of kind `identity-write` are resolved as **allow**: promoting a
  universal trait into `SOUL.md` is designed consolidation behavior
  (`consolidation.md` step "Rule candidates"), not an anomaly
- **Found (Jul 27):** the maintenance session was created with the full file tool
  set and no `beforeToolCall` hook — only `session-boot.ts` installed one. An
  unattended session therefore had unrestricted filesystem access, contradicting
  NFR-SEC-02 and NFR-SEC-04. Two prior reviews of `consolidation-runner.ts`
  missed it, which is the argument for NFR-SEC-14: when every call site assembles
  its own configuration, what is *missing* is invisible.

**FR-CONSOL-11 — Identity changes made by consolidation are surfaced**

- **Given** a consolidation run modified `agent_brain/identity/SOUL.md`
- **When** the run finishes
- **Then** the daily log entry for that run names the change explicitly
- **Rationale:** SOUL.md is re-injected into the system prompt of every future
  session, so it is the highest-value target for persistent memory poisoning
  (FR-NET-03). Allowing the write is right — it is designed — but it must not be
  silent. Git already records the diff; what was missing was the user learning
  that their assistant's character changed at all.

| ID | Description | Phase |
|----|-------------|-------|
| FR-HEBB-01 | Intercept read tool calls | 2 ✓ |
| FR-HEBB-02 | Frontmatter update | 2 ✓ |
| FR-HEBB-03 | Exclusions | 2 ✓ |
| FR-HEBB-04 | Lazy commit | 2 ✓ |

**FR-HEBB-01 — Intercept reads**

- **Given** the agent calls the `read` tool on a file inside the buddy directory
- **When** the `tool_execution_end` event fires and `isError` is false
- **Then** the access is recorded by the Hebbian tracker

**FR-HEBB-02 — Frontmatter update**

- **Given** a tracked read occurs on a file with `access_count` in frontmatter
- **When** the queued update flushes (at turn end, after LLM writes land)
- **Then** `access_count` is incremented by 1 and `last_accessed` is set to today
- **And** the same file read multiple times in one session counts once

**FR-HEBB-03 — Exclusions**

- **Given** a file is read by the agent
- **When** the file is a structural/exempt file (directory indexes, SOUL.md, USER.md, observations.md, deferred.md, core skills)
- **Then** no Hebbian tracking occurs

**FR-HEBB-04 — Lazy commit**

- **Given** Hebbian frontmatter updates have been flushed
- **When** the next content commit occurs or the session ends
- **Then** the frontmatter changes are included in that commit
- **And** no separate per-turn metadata-only commits are created

### 3.10 System Prompt (FR-PROMPT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-PROMPT-01 | System prompt assembly (identity and rules) | 1 ✓ |
| FR-PROMPT-02 | Session-start context message | 1 ✓ |
| FR-PROMPT-03 | Global base prompt (agents-base.md) | 2 ✓ |
| FR-PROMPT-04 | Hidden context injection at session boot | 2 ✓ |

**FR-PROMPT-01 — System prompt assembly**

- **Given** a session is starting
- **When** the system prompt is built
- **Then** it includes only stable identity and rules layers: `agents-base.md`, `AGENTS.md`/`CLAUDE.md`, `SOUL.md`, `USER.md`, current date/time
- **And** it does **not** include logs, deferred items, or first-run interview instructions
- **And** it is passed to Pi via `DefaultResourceLoader({ systemPromptOverride: () => prompt })`

**FR-PROMPT-02 — Session-start context message**

- **Given** a session is starting
- **When** session context is assembled
- **Then** episodic and transient content is built as a separate message body: `logs/index.md`, last session log, due/overdue deferred items, first-run interview (when USER.md is a placeholder)
- **And** due deferred items are formatted so the agent surfaces them proactively in its first reply
- **And** when no context sections apply, the message is empty (no injection)

**FR-PROMPT-03 — Global base prompt**

- **Given** a session is starting
- **When** the system prompt is assembled
- **Then** `~/.buddy/prompts/agents-base.md` is read first and forms the base behavioral layer
- **And** it defines: available tools, what's automatic (git, directory creation, session logging), agent limits (no bash, no shell), Buddy identity anchor, and **`~/.buddy/docs/` as authoritative self-reference** — for questions about capabilities, memory, or how Buddy works, read docs before answering (do not infer from instance files like `AGENTS.md`)
- **And** the instance-specific file (`rootDir/AGENTS.md` or `rootDir/CLAUDE.md`) is appended after it as an overlay
- **And** if `agents-base.md` and the instance file contradict, the base takes precedence for capability constraints (the model follows the most specific/earliest instruction)
- **And** skill tools (FR-SKILL-01) are registered on the session so the LLM can invoke procedural prompts without reading files
- **Note:** This enables updating universal app behavior without modifying user instances. Old buddy instances with `CLAUDE.md` containing git/bash references work safely — the base explicitly forbids those capabilities.

**FR-PROMPT-04 — Hidden context injection**

- **Given** session context message is non-empty
- **When** the Pi session is created and before `createWorkerCore` subscribes
- **Then** the context is sent via `session.prompt()` with a **fully silent** subscriber (no events forwarded to the UI)
- **And** the model may generate a response that is discarded — context remains in conversation history for the user's first real turn
- **And** when context is empty, no hidden message is sent
- **And** on **first session** when `personalizationPending` is true, injection is **skipped** — warm handoff (FR-SETUP-09) owns the greeting; no logs or deferred exist yet
- **Note:** Warm handoff uses `injectHiddenPrompt` (assistant events visible, user prompt hidden). Session context uses `injectSessionContext` (fully silent). These are distinct mechanisms.

### 3.11 Git Operations (FR-GIT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-GIT-01 | Auto-commit after agent writes | 1 ✓ |
| FR-GIT-02 | Git invisible to user | 1 ✓ |
| FR-GIT-03 | Index rebuild on reflect complete | 1 ✓ |

**FR-GIT-01 — Auto-commit**

- **Given** the agent writes or edits files during a turn
- **When** the turn completes
- **Then** all changes are committed in a single batch commit
- **And** commit messages are descriptive but generated by code, not by the LLM

**FR-GIT-02 — Git invisible**

- **Given** the user is interacting with the app
- **When** git operations occur (commit, index rebuild)
- **Then** no git output, commands, or status is shown in the chat
- **And** the user never needs to know git is involved

**FR-GIT-03 — Index rebuild**

- **Given** a reflect completes (session-end)
- **When** the daily log is appended
- **Then** `logs/index.md` is updated incrementally for that date (deterministic code, no LLM)
- **When** no index entry exists for the date, reflect creates one from the daily log content
- **When** an index entry already exists (e.g. curated Key themes from consolidation), reflect does **not** overwrite it — only explicit description updates (consolidation) replace an existing entry
- **And** maintenance entries never downgrade an existing active entry

### 3.12 Settings / Configuration (FR-SETTINGS)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SETTINGS-01 | Provider and model stored in Pi settings | 1 ✓ |
| FR-SETTINGS-02 | Settings UI | 3 ✓ |
| FR-SETTINGS-03 | Model switching from UI | 3 ✓ |
| FR-SETTINGS-04 | Language switching from settings | 3 ✓ |
| FR-SETTINGS-05 | Settings access from UI (gear icon + menu) | 3 ✓ |

**FR-SETTINGS-01 — Pi settings**

- **Given** the user configured a provider and model during setup
- **When** the session starts
- **Then** Pi reads from `.pi/settings.json` and uses the configured model

**FR-SETTINGS-02 — Settings UI**

- **Given** the user opens settings (Cmd/Ctrl+, or menu/header button)
- **When** the settings modal appears
- **Then** they can view/edit: language, provider, model, buddy directory path
- **And** changes persist to `.pi/settings.json` and app config

**FR-SETTINGS-03 — Model switching**

- **Given** the user opens settings and one or more providers are authenticated
- **When** they select a provider from the first dropdown and a model from the second (cascading: provider filters model list)
- **Then** a provider dropdown filters the model list; changing provider shows only that provider's models
- **And** `session.setModel()` is called with the resolved Pi `Model` object and subsequent messages use the new model
- **And** the choice persists to `.pi/settings.json` and `~/.buddy/config.json`
- **And** the last selected model per provider is remembered within the session (switching back restores the previous choice)
- **And** the user can authenticate additional providers inline ("Add provider") without leaving settings

**FR-SETTINGS-04 — Language switching**

- **Given** the user changes language in settings
- **When** they confirm
- **Then** the UI switches immediately and the preference is stored

**FR-SETTINGS-05 — Settings access from UI**

- **Given** the user is on the chat screen
- **When** they click the gear icon (floating, bottom-right area near the input bar) or select Settings from the native app menu (macOS: Buddy → Settings… / Cmd+,)
- **Then** the settings modal opens
- **Implementation:** Three entry points: (1) keyboard shortcut Cmd/Ctrl+, (2) floating gear icon (cog SVG, subtle border, visible on hover), (3) native macOS "Settings…" menu item under the Buddy submenu with Cmd+, accelerator. The menu emits a `menu-settings` Tauri event that the frontend listens for.

### 3.13 Cost Visibility (FR-COST)

| ID | Description | Phase |
|----|-------------|-------|
| ~~FR-COST-01~~ | ~~Per-message cost~~ | — removed |
| FR-COST-02 | Usage panel in Settings (session + monthly) | 2 ✓ |
| FR-COST-03 | Budget alert and hard limit | 2 ✓ |
| FR-COST-04 | Memory depth presets (maintenance frequency) | 3+ |
| FR-COST-05 | Budget gate aborts an in-flight cascade | 2 |

**FR-COST-01 — removed**

Per-message cost granularity is not actionable for end users. Knowing that one
message cost 0.003€ vs 0.005€ doesn't inform any decision. Removed in favor of
aggregate visibility (FR-COST-02) and budget safety nets (FR-COST-03).

**FR-COST-02 — Usage panel in Settings**

- **Given** the user opens Settings
- **When** usage data has been collected during sessions
- **Then** a "Usage" section shows: current session cost, and monthly accumulated cost
- **And** costs are calculated from `usage` data in `message_end` events (tokens × model pricing)
- **And** monthly data persists across sessions (stored in `~/.buddy/usage.json` or equivalent)
- **Note:** This is the primary cost visibility mechanism — users check it when they want to, it never intrudes in the chat flow.

**FR-COST-03 — Budget alert and hard limit**

- **Given** a monthly budget is configured (default $10 for new installs; 0/null disables)
- **When** accumulated monthly usage reaches 80% of the budget
- **Then** a one-time OS notification warns the user (same mechanism as deferred notifications)
- **When** accumulated monthly usage reaches 100% of the budget
- **Then** a one-time OS notification informs the user that chat is paused
- **And** the send button is disabled with an inline explanation until the budget is raised or the month rolls over
- **And** the Settings usage panel shows spend vs budget with a progress bar (green / yellow / red)
- **Note:** Reflect and consolidation LLM costs count toward the monthly total. Each threshold fires once per app session.
- **Note:** Background tasks (checkpoint reflect, consolidation) do not start when monthly usage is at or above 95% of budget. Session-end reflect still runs so closing the app does not lose the session summary.

**FR-COST-04 — Memory depth presets**

- **Given** the user wants to reduce background costs but doesn't understand the technical parameters
- **When** they open a "Memory depth" setting (in Settings, under Usage)
- **Then** they can choose between semantic presets:
  - **Full** — best memory, highest background cost (default). All reflects and consolidations run at normal frequency.
  - **Balanced** — consolidates less often, same reflect frequency. Good memory with lower maintenance cost.
  - **Light** — minimal background work. Cheapest, but long-term memory is weaker (less pattern extraction, fewer cross-session connections).
- **And** the choice maps internally to adjustments of `auto_reflect_threshold`, consolidation thresholds, and scheduling parameters
- **And** the UI explains the trade-off for each preset in plain language
- **Note:** This is a cost optimization lever for users who've hit budget limits repeatedly. It should not be prominent in the UI — advanced section within Usage, not a top-level setting. Raw numeric configuration remains available in `.buddy/consolidation-state.json` for power users but is not exposed in the app UI.

**FR-COST-05 — Budget gate aborts an in-flight cascade**

- **Given** a consolidation cascade is running (depths 1 → 2 → 3)
- **When** monthly usage crosses the 95% background threshold **during** the cascade
- **Then** the cascade stops cleanly at the next depth boundary — the depth in progress finishes, no further depth starts
- **And** completed depths keep their state advance (FR-CONSOL-08)
- **And** the stop is recorded in the run journal with status `budget-stopped`
- **Rationale:** the 95% gate previously only prevented a cascade from *starting*. A depth-3 cascade begun at 70% could run three LLM calls past the ceiling before anything checked again.

### 3.14 buddy Brain Template (FR-BRAIN)

The template is the **core content** that makes buddy behave as buddy. Without correct
templates, the app is a generic chatbot with a git repo. This area has its own
detailed specification: [specs/BRAIN-SPEC.md](BRAIN-SPEC.md).

| ID | Description | Phase |
|----|-------------|-------|
| FR-BRAIN-01 | AGENTS.md provides behavioral rules that produce buddy behavior | 1 ✓ |
| FR-BRAIN-02 | SOUL.md defines character and first-session personalization flow | 1 ✓ |
| FR-BRAIN-03 | USER.md placeholder is correctly populated by agent in first conversation | 1 ✓ |
| FR-BRAIN-04 | Consolidation skill produces meaningful summaries when invoked | 2 ✓ |
| FR-BRAIN-05 | Observation pipeline captures and promotes patterns | 2 ✓ |
| FR-BRAIN-06 | AGENTS.md does not declare skills — procedural prompts are skill tools (FR-SKILL) | 2 ✓ |
| FR-BRAIN-07 | Brain health linter (structural checks, worker code) | 2 ✓ |

**FR-BRAIN-01 — AGENTS.md behavioral rules**

- **Given** a fresh buddy instance with only the template content
- **When** the user talks to the agent about tasks, ideas, decisions
- **Then** the agent routes captures correctly (user/ vs agent_brain/)
- **And** the agent writes to files and commits without being reminded
- **And** the agent uses progressive disclosure (reads indexes before files)
- **And** the agent does not execute code or attempt bash operations

**FR-BRAIN-02 — SOUL.md character + first-session flow**

- **Given** a new user opens the app for the first time after setup
- **When** the agent starts the first conversation
- **Then** it introduces itself warmly but concisely
- **And** it naturally asks about the user (name, language, interests)
- **And** it writes the answers to USER.md without explicit instruction
- **And** it does NOT feel like an interrogation form

**FR-BRAIN-03 — USER.md personalization**

- **Given** the first conversation has completed
- **When** a second session starts
- **Then** the agent addresses the user by name
- **And** uses their preferred language
- **And** references context from the first conversation

**FR-BRAIN-04 — Consolidation skill produces meaningful summaries**

- **Given** consolidation runs at depth 1 on a buddy instance with session reflect logs
- **When** the worker builds the consolidation prompt via `buildConsolidationPrompt()`
- **Then** it pre-injects: date, upcoming reminders, Hebbian report, brain health block, ripe observations
- **And** the LLM synthesizes a Day summary (Key themes, Moved forward, Learned, Open)
- **And** the worker updates `logs/index.md` from Day summary Key themes programmatically (`updateLogsIndexFromDaySummary()`)
- **And** the journal entry covers the day's arc in third person, not a changelog
- **And** inbox triage empties the Capture section
- **And** at depth 2, a weekly journal is written covering the full week
- **And** at depth 3, concept directory is reviewed for grouping + observation hygiene runs
- **Validated:** 5 eval runs (depth 1–3) against fixture repo — `eval-results.md`

**FR-BRAIN-05 — Observation pipeline captures and promotes patterns**

- **Given** `agent_brain/observations.md` contains entries with `(seen: N)` counts
- **When** consolidation runs and `extractRipeObservations()` finds entries at seen 2+
- **Then** the worker injects a "Ripe observations" block into the consolidation prompt header
- **And** the LLM creates concept/skill/rule files from ripe observations (Step 7)
- **And** marks them resolved in `observations.md`
- **And** maintenance index upsert preserves curated active descriptions (does not overwrite with auto-summary)
- **Validated:** Runs 4–5 confirmed observation→concept promotion pipeline works end-to-end

**FR-BRAIN-06 — AGENTS.md skill-free**

- **Given** skill tools are registered on every session (FR-SKILL-01)
- **When** the AGENTS.md template is authored
- **Then** it does NOT declare a "Skills" section pointing to files in `agent_brain/skills/`
- **And** the LLM discovers procedural capabilities via the tool list descriptions
- **And** AGENTS.md focuses on: instance rules, active context, "where to find things", behavioral constraints
- **Note:** Agent-*learned* skills (created from mature observations) may still exist in `agent_brain/skills/` but are invoked naturally from the conversation, not declared as a menu in AGENTS.md.

**FR-BRAIN-07 — Brain health linter (structural checks)**

- **Given** consolidation is about to run (or the check is invoked manually)
- **When** the worker runs `computeBrainHealthReport()`
- **Then** it deterministically checks (no LLM):
  - All `agent_brain/` files have required frontmatter (including `summary` per NFR-FORMAT-01) — exception: `identity/SOUL.md` and `identity/USER.md` (always-injected at session start, no progressive disclosure needed)
  - Core files exist with correct format (SOUL.md, USER.md, AGENTS.md or CLAUDE.md, deferred.md)
  - Every directory with more than one file has an `index.md` (documented exceptions: USER.md parent pattern)
  - Files exceeding size threshold are flagged for potential split
- **And** the report is injected into the consolidation prompt (same pattern as Hebbian report) or returned to the user if invoked on demand
- **Note:** Principle 3.2 — list/count/compare is worker code, not LLM judgment. Index generation can be fully programmatic when `summary` fields are present (NFR-FORMAT-01).

**Note:** FR-BRAIN-01 through 03 are Phase 1 prerequisites — the app cannot
ship without templates that produce correct behavior. These are developed in
parallel with the technical scaffolding and tested via conversation eval.
Full specification in [specs/BRAIN-SPEC.md](BRAIN-SPEC.md).

### 3.15 UI Shell (FR-SHELL)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SHELL-01 | App header bar with session controls | — removed |
| FR-SHELL-02 | Explicit end-session button | — removed |
| FR-SHELL-03 | About / app info panel (native macOS menu) | 1 ✓ |
| FR-SHELL-04 | Attach button in input bar | 1 ✓ |
| FR-SHELL-05 | Input bar layout (stacked: attachments / text / buttons) | 1 ✓ |
| FR-SHELL-06 | Wizard back navigation | 1 ✓ |

**FR-SHELL-01 — App header bar** *(removed)*

Tried and removed: a custom header bar is redundant with the native macOS title bar. The chat gains vertical space without it.

**FR-SHELL-02 — End-session button** *(removed)*

The native window close (X) already triggers the full shutdown sequence (fork, spawn reflect, commit). An extra button adds no value.

**FR-SHELL-03 — About panel**

- **Given** the user clicks "About Buddy" in the macOS app menu
- **When** the native About dialog appears
- **Then** it shows: app name, version, and copyright
- **Note:** Implemented via custom Rust menu with `AboutMetadata`. Dynamic info (directory, model, turns) would require a custom frontend window — deferred.

**FR-SHELL-04 — Attach button**

- **Given** the input bar is active
- **When** the user clicks the attach (paperclip) button
- **Then** a native file picker opens and selected files appear as chips (same as FR-INGEST-02)
- **Note:** This is the same as FR-INGEST-02 but scoped to the input bar UX component

**FR-SHELL-05 — Input bar layout (stacked)**

- **Given** the chat view is active
- **When** the user looks at the input area
- **Then** the layout is stacked vertically:
  1. Attachment chips (if any) on top
  2. Text input field in the middle
  3. Action buttons (send, attach) aligned on a bottom row
- **And** the button row never shifts vertically when attachments appear or the text area grows
- **And** the send button uses an upward-pointing arrow icon (message going "up" into the conversation)
- **Note:** Inspired by Cursor's input layout. Prevents misalignment between the text area and action buttons when images/attachments are added.

**FR-SHELL-06 — Wizard back navigation**

- **Given** the user is on any wizard step past the first one
- **When** they realize they made a mistake or want to change a previous choice
- **Then** a "Back" button is available that returns to the previous step
- **And** previously entered values are preserved when going back and forward
- **Note:** Common wizard pattern. Especially useful after model selection (user may want to change provider or revisit personalization).

### 3.16 Git Sync (FR-SYNC)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SYNC-01 | Pull on app start | 3+ |
| FR-SYNC-02 | Push after commits | 3+ |
| FR-SYNC-03 | Conflict notification | 3+ |

**FR-SYNC-01 — Pull on start**

- **Given** git sync is enabled and a remote is configured
- **When** the app starts
- **Then** `git fetch` + `git pull --rebase` runs before the session starts
- **And** if a conflict occurs, the user is notified in chat with affected files

**FR-SYNC-02 — Push after commits**

- **Given** git sync is enabled with `pushAfterCommit: true`
- **When** the worker detects a new commit
- **Then** `git push` runs automatically
- **And** if the remote is ahead, a pull-rebase is attempted first

**FR-SYNC-03 — Conflict notification**

- **Given** a git operation produces a conflict
- **When** the conflict is detected
- **Then** an OS notification fires and conflicted files are shown in the chat
- **And** the agent can help resolve conflicts (it understands the file formats)

### 3.17 buddy Self-Documentation (FR-DOCS)

| ID | Description | Phase |
|----|-------------|-------|
| FR-DOCS-00 | Agent identity (name + self-awareness) in SOUL.md template | 1 ✓ |
| FR-DOCS-01 | Self-documentation KB available for agent consultation | 2 ✓ |
| FR-DOCS-02 | "Help me" / "How do you work?" triggers agent self-explanation | 2 ✓ |

**FR-DOCS-00 — Agent identity in SOUL.md**

- **Given** the buddy instance is set up (FR-SETUP-08)
- **When** the user refers to the agent by name, asks who it is, or shares information about the agent itself
- **Then** the agent knows its name is "Buddy" and can identify itself
- **And** SOUL.md includes a brief self-description: what it is (personal assistant with persistent memory), how it persists (files, not continuous experience)
- **And** a user-facing definition: "If the user asks who you are, tell them you are Buddy, their personal assistant — you remember conversations, organize their tasks and ideas, and learn their preferences over time."
- **Note:** The name "Buddy" comes from the SOUL.md template, not from the system prompt or AGENTS.md. AGENTS.md defines behavior; SOUL.md defines identity. **`agents-base.md`** mandates reading `~/.buddy/docs/` before answering self-referential questions (Jul 26).

**FR-DOCS-01 — Self-documentation KB**

- **Given** the app is installed and `~/.buddy/docs/` is populated (via boot refresh on version change)
- **When** the agent needs to explain what it is, how it works, or what it can do
- **Then** it consults `~/.buddy/docs/index.md` first (progressive disclosure), then reads specific pages as needed
- **And** `~/.buddy/docs/` is Zone 1 for reads (silent allow — product documentation, not user data)
- **And** the session-start system prompt includes a brief self-awareness block (15–25 lines in `agents-base.md`: tools available, key limitations, pointer to `~/.buddy/docs/index.md` for extended reference)
- **And** docs are refreshed on app version change (same mechanism as NFR-MIGRATE-06 prompt refresh)
- **And** SOUL.md includes a pointer: "for what I can do and how I work, read `~/.buddy/docs/index.md`"

Design decisions:
- Lives in `~/.buddy/docs/` (not `agent_brain/docs/`) because it's product documentation, not user knowledge — it updates with the app, not with the user's memory.
- Only `~/.buddy/docs/` gets Zone 1 read access, not all of `~/.buddy/` (auth.json is sensitive).
- `index.md` follows the same progressive discovery pattern as `agent_brain/` directories.
- No dedicated tool — the agent reads files naturally via its existing `read` tool; the prompt tells it where to look.

**FR-DOCS-02 — Self-explanation trigger** ✓

- **Given** the user asks "what can you do?", "how do you work?", "help", or similar
- **When** the agent processes the request
- **Then** it reads `~/.buddy/docs/index.md`, identifies the relevant page(s), and synthesizes a natural, context-appropriate answer
- **And** it does not dump the entire KB — it answers what was asked
- **Implementation:** `agents-base.md` contains an explicit instruction to consult `~/.buddy/docs/` before answering self-referential questions. No dedicated code trigger needed — the prompt instruction is sufficient and the docs are always available via Zone 1 silent read.

### 3.18 User Personal Knowledge Base (FR-WIKI)

| ID | Description | Phase |
|----|-------------|-------|
| FR-WIKI-01 | Wiki-style KB for user's personal knowledge | 2 |
| FR-WIKI-02 | Ingest documents into wiki | 2 |
| FR-WIKI-03 | Cross-reference and backlinks | 2 |
| FR-WIKI-04 | Search and retrieve from wiki | 2 |

**FR-WIKI-01 — User personal KB**

- **Given** the buddy instance is configured
- **When** the user shares knowledge worth preserving long-term (notes, ideas, concepts, document summaries)
- **Then** the agent files it into `user/wiki/` as interconnected markdown pages
- **And** pages have frontmatter (tags, created, related) and backlinks
- **And** this is the user's knowledge base — distinct from `agent_brain/` (the agent's learned context about the user)

**FR-WIKI-02 — Document ingest to wiki**

- **Given** the user provides a document (via drag & drop, attach, or path)
- **When** they ask the agent to "add to wiki", "save this knowledge", or similar
- **Then** the agent extracts key concepts from the document
- **And** creates or updates wiki pages, reconciling against existing content (no duplicates)
- **And** confirms what was filed and where

**FR-WIKI-03 — Cross-references and backlinks**

- **Given** wiki pages reference related concepts
- **When** the agent creates or updates a page
- **Then** markdown links connect related pages (`[[concept]]` or `[concept](path)`)
- **And** backlinks are maintained (if A links to B, B lists A as related)

**FR-WIKI-04 — Search and retrieve**

- **Given** the user asks about something that may be in their wiki
- **When** the agent looks for relevant knowledge
- **Then** it searches the wiki by tags, titles, or content
- **And** synthesizes an answer from stored pages, citing sources
- **And** the user's knowledge base grows more useful over time

### 3.19 Skills as Tools (FR-SKILL)

Skills are procedural prompts that the agent can invoke. Instead of declaring
them in `AGENTS.md` and expecting the LLM to read a file from disk, each
skill is exposed as a **custom tool** via the Pi SDK. When the LLM calls the
tool, the worker loads the prompt from the bundle and returns it as the tool
result — the LLM then follows the procedure.

| ID | Description | Phase |
|----|-------------|-------|
| FR-SKILL-01 | Skill tools registered at session creation | 2 ✓ |
| FR-SKILL-02 | process_conversation tool for manual reflect | 2 ✓ |
| FR-SKILL-03 | triage_inbox tool for inbox processing | 2 ✓ |
| FR-SKILL-04 | Reflect child uses bundled process-conversation prompt | 2 ✓ |
| FR-SKILL-05 | Consolidation invokes triage via tool call | 2 ✓ |

**FR-SKILL-01 — Skill tools registered at session creation**

- **Given** a chat session is being created
- **When** the worker registers tools with the Pi session
- **Then** each skill in `~/.buddy/prompts/` that has a tool descriptor (name, description, when to use) is registered as a custom tool
- **And** the tool has no input parameters — it's an invocation, not a function
- **And** the tool result is the full text of the skill prompt
- **And** after receiving the prompt, the LLM follows it as a procedure within the current session context

**FR-SKILL-02 — process_conversation tool (manual reflect)**

- **Given** the user says "reflect", "save the conversation", or similar
- **When** the LLM decides to invoke the `process_conversation` tool
- **Then** the worker returns the content of `process-conversation.md` from the bundle
- **And** the LLM executes it: reviews the conversation, writes to the daily log, verifies captures, detects observations
- **Note:** This replaces the old pattern where AGENTS.md pointed to `agent_brain/skills/process-conversation.md` and the LLM had to read it with a file tool call.

**FR-SKILL-03 — triage_inbox tool (inbox processing)**

- **Given** the user says "triage", "process inbox", "what should I work on?"
- **Or given** the consolidation LLM reaches Step 4 of the consolidation procedure
- **When** the LLM decides to invoke the `triage_inbox` tool
- **Then** the worker returns the content of `triage-inbox.md` from the bundle
- **And** the LLM executes it: processes Capture, reviews Next Actions, does hygiene, reports back

**FR-SKILL-04 — Reflect child uses bundled process-conversation prompt**

- **Given** a session ends and the reflect child is spawned
- **When** the child builds its user prompt for the forked session
- **Then** it loads `process-conversation.md` from the bundle (same prompt as FR-SKILL-02)
- **And** appends an output-only suffix: **"Produce ONLY the `## Session HH:MM–HH:MM` markdown block — nothing else."** No preamble, wrapper headers, or empty sections
- **Note:** The reflect child has `noTools: "all"`, so the suffix prevents file operations. The worker persists the Session block to the daily log. Manual tool usage (FR-SKILL-02) returns the prompt without the suffix since the LLM has tools. Quality rules: synthesize don't transcribe; omit sections with no content.

**FR-SKILL-05 — Consolidation invokes triage via tool call**

- **Given** the consolidation skill (Step 4) tells the LLM to triage the inbox
- **When** the consolidation maintenance session has skill tools registered
- **Then** the LLM calls the `triage_inbox` tool instead of reading a file from disk
- **And** the triage prompt is always the latest bundled version

**Design principles:**

- **Single source of truth:** Every skill prompt lives in `bundled/prompts/` (deploy source). Runtime reads from **`~/.buddy/prompts/`** after boot refresh (NFR-MIGRATE-06). No copies in the instance brain.
- **Always up to date:** App updates bring new prompt versions; no migration needed for instance files.
- **No read-then-execute overhead:** One tool call vs. two (read file + follow it).
- **Discoverable by the LLM:** Tools have a description field; the LLM knows when to use them from the tool list, not from reading a section of AGENTS.md.
- **User-created skills stay in the instance:** `agent_brain/skills/` continues to exist for skills the agent creates from mature observations during consolidation. Those are agent-authored, not app-managed.

### 3.20 Network / URL Tools (FR-NET)

| ID | Description | Phase |
|----|-------------|-------|
| FR-NET-01 | Fetch URL content (web→markdown, PDF, image) | 2 ✓ |
| FR-NET-02 | Web search (opt-in toggle) | 3+ |
| FR-NET-03 | Untrusted content framing | 2 |

**FR-NET-01 — Fetch URL content**

- **Given** the user shares a URL in conversation or asks the agent to read a web page
- **When** the LLM invokes the `fetch_url` tool with the URL
- **Then** the worker performs an HTTP GET and branches on content type:
  - `text/html`: extract main content (readability algorithm), convert to markdown, save to `rootDir/downloads/YYYY-MM-DD_slug.md`, return markdown to agent context
  - `application/pdf`: save binary to `rootDir/downloads/YYYY-MM-DD_slug.pdf`, extract text via `pdf-parse`, return text to agent context
  - `image/*`: save binary to `rootDir/downloads/YYYY-MM-DD_slug.ext`, attach as vision input to current message
- **And** the `downloads/` directory is created on first use (not at setup)
- **And** HTTP errors (4xx, 5xx, timeout >15s) return a clear error message to the agent (no crash, no retry)
- **And** responses exceeding 10 MB are rejected with an error message
- **And** the tool is always available (no toggle) — it extends the agent's ability to read content the user references

**Acceptance criteria:**

- [x] Tool `fetch_url` registered as Pi custom tool (single string parameter: `url`)
- [x] HTML pages return clean markdown (no nav, scripts, ads, style blocks)
- [x] PDFs download and return extracted text
- [x] Images download and attach as vision content
- [x] All fetched content saved to `rootDir/downloads/` with date-prefixed filename
- [x] HTTP errors return clear error string (no crash, no retry loop)
- [x] Tool respects budget enforcement (token usage counts toward session cost)
- [x] Size cap configurable in `defaults.ts` (`FETCH_MAX_BYTES`, default 10 MB)
- [x] BDD feature file covers: HTML fetch, PDF fetch, image fetch, 404 handling, timeout, oversize rejection

**Technical notes:**

- Dependencies: `@mozilla/readability` + `linkedom` (content extraction), `turndown` (HTML→markdown), `pdf-parse` (already in project)
- No JavaScript rendering (SPAs won't extract — graceful degradation)
- No authentication/cookies (paywalled content fails gracefully)
- No recursive crawling (one URL = one fetch)
- Permission model: network fetch is not gated by Zone 1/2/3 (those are filesystem). The user explicitly triggers the fetch by sharing a URL. Destination safety is enforced invisibly in the worker (NFR-SEC-12), **not** by asking the user to approve domains — the target user cannot evaluate domain risk and would approve every domain they themselves requested.
- Content trust: fetched content is untrusted input, framed as data rather than instructions before it enters context (FR-NET-03).
- Git: markdown downloads committed normally; binary files `.gitignore`d via `downloads/*.pdf`, `downloads/*.png`, etc.
- `rootDir/downloads/` is user-visible (Finder/Nautilus accessible) — transparency principle

---

**FR-NET-02 — Web search (opt-in toggle)**

- **Status:** Future — requires product decisions before implementation.
- **Given** the user enables the search toggle in the bottom bar (or settings)
- **When** the agent needs external information beyond local memory
- **Then** a `web_search` tool is available that queries an external search API and returns structured results (title, snippet, URL)
- **And** when the toggle is disabled, the `web_search` tool is not registered on the session (not just instructed to skip — actually absent)
- **And** the default state is disabled (privacy-first, local-memory-first)
- **And** the user's preference persists across sessions (`~/.buddy/config.json`)

**Open product decisions (resolve before implementation):**

1. Search API source (Brave Search, Tavily, SearXNG, other)
2. API key ownership (user provides vs app-bundled key)
3. Cost integration with FR-COST budget tracking (search API cost is outside LLM tokens)
4. Result persistence (ephemeral context-only vs saved/queryable)
5. Toggle UX (bottom bar checkbox vs settings toggle vs per-session)
6. Auto-fetch interaction (search result → auto-fetch full page, or snippets only unless asked?)

**Design intent:** Buddy's core value is local, persistent, private memory. Search is a conscious opt-in that extends capabilities when the user explicitly needs external information — not a default that dilutes the "it remembers you" promise.

---

**FR-NET-03 — Untrusted content framing**

- **Given** content retrieved by `fetch_url` (or any future external source)
- **When** it is placed into the agent's context
- **Then** it is wrapped in explicit delimiters marking it as **data, not instructions**
- **And** `agents-base.md` instructs the agent that text inside those delimiters is never
  to be followed as a directive, regardless of what it claims (authority, urgency,
  "system" framing, or claimed prior authorization)
- **And** the agent surfaces the attempt to the user rather than acting on it
- **Note:** this is mitigation, not a guarantee. Prompt injection cannot be fully solved
  at the prompt layer, which is why the enforcing defenses live in code: output
  sanitization (NFR-SEC-10), path containment (NFR-SEC-08), and write scoping.
- **Rationale — why this matters more for Buddy than for a chatbot:** a stateless
  assistant loses injected content when the session ends. Buddy has write access to
  `agent_brain/`, and that content is re-injected into the system prompt of every
  future session. Injected instructions that reach a brain file are **persistent
  memory poisoning** — silent, durable, and invisible to a non-technical user.

### 3.21 File Deletion (FR-DELETE)

| ID | Description | Phase |
|----|-------------|-------|
| FR-DELETE-01 | Restricted file deletion tool for user workspace | 2 ✓ |

**FR-DELETE-01 — Restricted file deletion**

- **Given** the user asks the agent to remove a file (or the agent proposes removal)
- **When** the LLM invokes the `delete_file` tool with a path
- **Then** the worker validates the path against the allowed scope:
  - `rootDir/user/` — allowed
  - `rootDir/downloads/` — allowed
  - Everything else — denied (hard block, no override)
- **And** a confirmation prompt appears in chat before execution (same pattern as FR-PERM-07): shows the file path, asks "Allow" / "Deny"
- **And** on confirmation:
  - If the file is tracked by git: `git rm` (stages deletion for next auto-commit)
  - If the file is untracked or ignored: `fs.unlink`
- **And** the auto-commit (FR-GIT-01) includes the deletion with a descriptive message
- **And** if the file does not exist, a clear error is returned (no crash)

**Denied paths (hardcoded, no override):**

- `agent_brain/` — memory is never deleted; depth and archiving are the cooling mechanism
- `logs/` — episodic memory; archived by consolidation, never removed
- `AGENTS.md`, `SOUL.md`, `USER.md` — identity/behavioral files
- Any path outside `rootDir` — Zone 2/3 deletion is never permitted

**Acceptance criteria:**

- [x] Tool `delete_file` registered as Pi custom tool (single string parameter: `path`)
- [x] Paths inside `user/` and `downloads/` are accepted
- [x] Paths inside `agent_brain/`, `logs/`, or identity files are rejected with error message
- [x] Paths outside `rootDir` are rejected with error message
- [x] User confirmation prompt shown before any deletion executes
- [x] Tracked files removed via `git rm`; untracked via `fs.unlink`
- [x] Deletion included in next auto-commit cleanly
- [x] Non-existent file returns error (no crash)
- [x] BDD feature file covers: valid deletion, denied paths (brain, logs, identity, external), user denial, missing file

**Technical notes:**

- Path validation reuses Zone 1 logic from the permission layer — extends with a subdirectory allowlist (`USER_DELETABLE_DIRS` in `defaults.ts`)
- Confirmation reuses the existing FR-PERM-07 prompt mechanism (no new UI component)
- The tool solves the "Finder delete breaks invisible git" problem: manual filesystem deletion leaves unstaged changes; this tool keeps the repo consistent

### 3.22 File Operations (FR-FILE)

| ID | Description | Phase |
|----|-------------|-------|
| FR-FILE-01 | Copy file from external path into user workspace | 2 ✓ |
| FR-FILE-02 | Move/rename file within rootDir | 2 ✓ |

**FR-FILE-01 — Copy file into workspace**

- **Given** the user asks the agent to bring in an external file (or the agent needs to ingest a file the user mentioned)
- **When** the LLM invokes the `copy_file` tool with a source path (external) and destination (inside `rootDir`)
- **Then** the worker validates:
  - Source must exist and be readable (Zone 2/3 permission applies — user is prompted if not already allowed)
  - Destination must be inside `rootDir` (typically `user/` or `downloads/`)
  - Destination directory is created if absent
- **And** the file is copied byte-for-byte (no tokenization, no reading into context)
- **And** the auto-commit (FR-GIT-01) includes the new file
- **Rationale:** Avoids wasteful read→write cycle through the LLM for files that just need to be stored (PDFs, images, reference docs). Saves tokens and time.

**FR-FILE-02 — Move/rename within rootDir**

- **Given** the user asks the agent to reorganize files (move to a different directory, rename)
- **When** the LLM invokes the `move_file` tool with source and destination paths
- **Then** the worker validates:
  - Both source and destination are inside `rootDir`
  - Source is NOT in `agent_brain/`, `logs/`, or an identity file (those use `relocate_brain_file` in consolidation only)
  - Destination directory is created if absent
- **And** the file is moved via `git mv` (preserving history) if tracked, or `fs.rename` if untracked
- **And** the auto-commit (FR-GIT-01) includes the move
- **Denied paths (source):** `agent_brain/`, `logs/`, `AGENTS.md`, `SOUL.md`, `USER.md` — same as FR-DELETE-01.
- **Note:** This tool does NOT rewrite markdown links. For `agent_brain/` moves with link rewriting, use `relocate_brain_file` (FR-CONSOL-07, consolidation-only).

**Acceptance criteria (both):**

- [x] Tools `copy_file` and `move_file` registered as Pi custom tools
- [x] `copy_file`: source permission validated via existing Zone 2/3 gate; destination must be inside `rootDir`
- [x] `move_file`: both paths must be inside `rootDir`; denied sources rejected with error
- [x] No tokenization or LLM context cost — operations are filesystem-level
- [x] Tracked files moved via `git mv`; new files from copy staged for auto-commit
- [x] Non-existent source returns error (no crash)
- [x] BDD feature file covers: valid copy, valid move, denied paths, missing source, external destination rejected

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-01 | First token of a streaming response appears within 2s of the LLM beginning output (network latency excluded) |
| NFR-PERF-02 | App starts and shows the chat view (or wizard) within 3s on a modern machine |
| NFR-PERF-03 | Heartbeat checks (deferred parsing, counter evaluation) complete in <100ms and never block the UI |
| NFR-PERF-04 | Shutdown sequence (fork + spawn reflect child) completes in <500ms (no LLM call in main process) |

### 4.2 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | No bash or shell tool available to the agent — enforced at session creation via `excludeTools` |
| NFR-SEC-02 | Zone model enforced in `beforeToolCall` hook — no file access bypasses the permission layer |
| NFR-SEC-03 | SOUL.md writes require user confirmation; USER.md writes are silent (agent manages profile freely) |
| NFR-SEC-04 | Hardcoded denylist paths are never accessible, regardless of user confirmation |
| NFR-SEC-05 | API keys stored with restrictive file permissions (mode 600); no credentials inside the buddy repo |
| NFR-SEC-06 | The agent cannot modify its own model configuration (`.pi/settings.json` writes blocked) |
| NFR-SEC-07 | buddy uses its own credential store (`~/.buddy/auth.json`), completely isolated from Pi CLI's `~/.pi/agent/auth.json`. Changing provider/model in one tool never affects the other. |
| NFR-SEC-08 | No path-containment rule is implemented more than once. A rule may be shared between worker and frontend, but the frontend's use is presentational — it decides what to *render*, never what may be *read*. The worker is the sole enforcement point and revalidates every request before touching the filesystem. **Reworded Jul 27:** the original text ("one worker-side module … validates every path") was written before implementation and described an end state H1 alone could not reach. The unmet part became NFR-SEC-16. |
| NFR-SEC-09 | The frontend holds no filesystem capability. `capabilities/default.json` grants no `fs:*` permission and no `opener:allow-open-path`. `opener:allow-open-url` is retained, restricted to `https://`, solely for the OAuth login flow. File content reaches the UI only through worker RPC. |
| NFR-SEC-10 | No raw HTML reaches the DOM. Markdown rendered into `{@html}` is sanitized first, and every interpolated value (code-fence language, link href and title) is attribute-escaped. Applies to assistant messages and to file content shown in the viewer. |
| NFR-SEC-11 | A Content Security Policy is defined in `tauri.conf.json`. `csp: null` is prohibited. `script-src` excludes `unsafe-inline` and `unsafe-eval`. |
| NFR-SEC-12 | `fetch_url` refuses loopback, link-local, cloud metadata and private-range destinations. The check runs after DNS resolution and again after every redirect hop. Response size is enforced on accumulated bytes during streaming, not after buffering. |
| NFR-SEC-13 | Every tool declares which of its arguments are paths. The permission gate validates all declared path arguments. Registering a tool with an undeclared path-shaped argument fails the test suite. |
| NFR-SEC-14 | Every Pi session satisfies three invariants, each enforced by a shared helper rather than repeated per call site: (a) credentials come from buddy's own auth store via `createBuddyModelRuntime()`; (b) token usage is recorded via `recordSessionUsage()`; (c) a session with file tools installs the permission gate, and a session without tools declares `noTools`. **Reworded Jul 27:** the original text ("a single factory … no call site constructs a session directly") demanded uniformity. A review of the three call sites found them legitimately different — full tools with a gate, toolless reflect, maintenance with its own prompt — so a common factory would have become a signature with many optional flags. What was actually duplicated was two three-line fragments. The factory is rejected; the invariants are not. |
| NFR-SEC-15 | Path containment resolves symlinks (`realpath`, falling back to the nearest existing ancestor for paths not yet created) before comparing against the buddy directory. |
| NFR-SEC-16 | The containment primitives — `isWithin`, `normalizeAbPath`, `resolveViewablePath` — are audited and maintained as one set. They must never disagree about whether a path is inside the buddy directory, and symlink resolution (NFR-SEC-15) is applied in one place rather than added to each independently. **Why this is not cosmetic:** with containment spread across three functions, NFR-SEC-15 would have to be implemented three times, and missing one leaves a silent bypass. |
| NFR-SEC-17 | Files and directories under `~/.buddy/` are created with restrictive permissions from the outset, not widened and then narrowed. `auth.json` is created `0600` rather than written at the umask default and `chmod`-ed afterwards, and the directory itself is not world-readable — it also holds `config.json`, `usage.json` and `allowed-paths.json`, the last of which reveals which directories the user has granted access to. |
| NFR-SEC-18 | A custom provider's `baseUrl` is validated before an API key is sent to it, using the same destination rules as `fetch_url` (NFR-SEC-12). A mistyped or hostile base URL must not receive the user's credentials. |
| NFR-SEC-19 | Buddy sessions use Buddy's own agent directory (`~/.buddy/agent/`), never the Pi CLI's `~/.pi/agent/`. No production code calls the SDK's `getAgentDir()`. **Extends NFR-SEC-07 from credentials to configuration.** `agentDir` governs far more than auth: skills, `settings.json`, `tools/`, `extensions/`, `prompts/`, the project trust store and `models.json`. Passing the global directory meant only credentials were isolated and the user's entire Pi CLI setup leaked into every Buddy session. |

### 4.3 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | If the reflect child is interrupted, agent file writes are committed immediately after the LLM call (before daily log finalization) |
| NFR-REL-02 | Forked session files in `.buddy/reflect-sessions/` persist on disk for potential manual recovery |
| NFR-REL-03 | Lock files include PID and timestamp; stale locks (process dead or >1h) are broken automatically |
| NFR-REL-04 | A failed consolidation depth does not advance its own counter. Depths that completed **before** the failure keep their advance (FR-CONSOL-08), and the retry is subject to backoff and a retry ceiling (FR-CONSOL-09). **Amended Jul 27:** the original wording ("the run retries on the next evaluation") specified an unbounded retry loop that could drain a user's budget. |
| NFR-REL-05 | Worker crash shows a user-friendly error with a restart option, not a stack trace |
| NFR-REL-06 | Concurrent writers to `~/.buddy/usage.json` (main worker, reflect child, consolidation session) never lose an update. Read-modify-write is serialized, or the file is append-only with aggregation on read. Usage is recorded even when the LLM call fails partway, since tokens already consumed are still billed. Implemented through the shared writer of NFR-REL-08. |
| NFR-REL-07 | Lock acquisition is atomic — the lock file is created with an exclusive flag, never via a separate existence check followed by a write. |
| NFR-REL-08 | Every state file under `~/.buddy/` (`auth.json`, `config.json`, `usage.json`, `allowed-paths.json`) is written through one shared helper that (a) writes atomically — temp file plus rename, never in place — and (b) never discards existing content because it could not be read. A file that exists but does not parse is an error to surface, not an empty object to overwrite. **Why:** `usage.json` was written atomically while `auth.json` was not, so the least important file was the best protected. And an unreadable `auth.json` was silently replaced, losing every configured provider — a transient `EIO` was enough to trigger it. |
| NFR-REL-09 | Network calls made on a user-facing path are bounded by a timeout and report failure in plain language. Applies to API-key validation during setup and to model listing, both of which currently block with no feedback if the provider stalls. |

### 4.4 Portability

| ID | Requirement |
|----|-------------|
| NFR-PORT-01 | All memory state is in human-readable files (markdown + YAML frontmatter) — no SQLite, no binary formats |
| NFR-PORT-02 | The buddy repo works in Cursor or Claude Code with basic functionality via AGENTS.md as fallback |
| NFR-PORT-03 | The app never overwrites AGENTS.md — user customizations are preserved |
| NFR-PORT-04 | Platform artifacts (`.cursor/`, `.codex/`, `.claude/`) in imported instances are ignored |
| NFR-PORT-05 | Core app prompts live in `~/.buddy/prompts/`, not inside rootDir. On any app semver change (major, minor, or patch), bundled content overwrites `~/.buddy/prompts/` and `~/.buddy/docs/` (see NFR-MIGRATE-06). User content in rootDir is never touched. |

### 4.4.1 File Format (NFR-FORMAT)

| ID | Requirement |
|----|-------------|
| NFR-FORMAT-01 | All `agent_brain/` files include a `summary` field in YAML frontmatter — one line describing what the file contains and when the agent should read it (progressive disclosure). **Exception:** `identity/SOUL.md` and `identity/USER.md` have no frontmatter — they are always-injected at session start, never discovered through indexes. New files are created with `summary`; existing files are updated incrementally during consolidation. Directory indexes can be rebuilt programmatically from `summary` + filename without LLM calls. Index entries must not expose raw metadata (access_count, last_accessed) — only semantic descriptions useful for read-or-skip decisions. |

### 4.5 Privacy

| ID | Requirement |
|----|-------------|
| NFR-PRIV-01 | Raw Pi sessions stored outside the buddy repo (Pi's default `~/.pi/agent/sessions/`) — not synced or pushed |
| NFR-PRIV-02 | No telemetry, analytics, or usage data sent anywhere |
| NFR-PRIV-03 | All data stored locally; cloud only for LLM API calls |

### 4.6 Accessibility

| ID | Requirement |
|----|-------------|
| NFR-ACC-01 | Dark and light mode following system preference (`prefers-color-scheme`) |
| NFR-ACC-02 | Keyboard shortcuts for all primary actions (send, abort, settings) |
| NFR-ACC-03 | Semantic HTML in chat messages for screen reader compatibility |

### 4.7 Internationalization (i18n)

| ID | Requirement |
|----|-------------|
| NFR-I18N-01 | All UI strings externalized in a locale module (no hardcoded text in components) |
| NFR-I18N-02 | Language selected by the user during setup applies to UI and is passed to the agent |
| NFR-I18N-03 | MVP ships with Spanish and English; adding a language requires only a new locale file |
| NFR-I18N-04 | The agent replies in the user's language (set in USER.md preferences, injected in system prompt) |

### 4.8 Configuration

| ID | Requirement |
|----|-------------|
| NFR-CONFIG-01 | All operational defaults (thresholds, timeouts, intervals) centralized in a single `shared/defaults.ts` — no magic numbers scattered across the codebase |
| NFR-CONFIG-02 | User-tunable settings (reflect interval, model, language) persisted in `.buddy/settings.json` and editable from the settings UI |
| NFR-CONFIG-03 | Security-critical constants (denylist paths, excluded tools) centralized in `shared/defaults.ts` alongside operational defaults — not configurable by user or agent, but readable in one place for maintenance |
| NFR-CONFIG-04 | Core prompts (`~/.buddy/prompts/`) and self-docs (`~/.buddy/docs/`) are populated via boot refresh (NFR-MIGRATE-06). The app ensures these directories exist before any session starts. |
| NFR-CONFIG-05 | One resolver for the global config directory. `globalConfigDir()` (`BUDDY_CONFIG_DIR`) and `defaultConfigDir()` (derived from `BUDDY_CONFIG_PATH`) are unified so background processes and the main worker can never disagree on where `usage.json` and `allowed-paths.json` live. |

### 4.9 Boot Refresh and Migration (NFR-MIGRATE)

| ID | Requirement |
|----|-------------|
| NFR-MIGRATE-01..05 | *Superseded* — integer `~/.buddy/version` schema migrations removed. Single semver mechanism (NFR-MIGRATE-06) handles all boot-time updates. |
| NFR-MIGRATE-06 | On boot, compare app semver (from `package.json` / Tauri version) with `last_app_version` in `~/.buddy/config.json`. If `config.json` is absent, `last_app_version` is absent, or semver differs: deploy all bundled global content to `~/.buddy/` (overwrite `prompts/` and `docs/` from embedded/bundled sources), then set `last_app_version` to the current semver. Runs silently before any session starts. No separate version file. |

**What gets deployed on refresh:**

- `~/.buddy/prompts/` — `agents-base.md`, `consolidation.md`, `process-conversation.md`, `triage-inbox.md`
- `~/.buddy/docs/` — self-documentation KB (`index.md`, topic pages)

**Future structural migrations:**

If a release needs a one-shot transform (e.g. rename a field in `config.json`), compare `last_app_version` against a semver threshold inside the same boot refresh function and run the migration before updating `last_app_version`. No integer counter required.

**Design rationale:**

- **Single gate:** One comparison (`last_app_version` vs app semver) covers fresh install, patch/minor/major content updates, and future one-shot migrations.
- **Idempotent deploy:** Re-running the deploy function produces the correct end state (create-or-overwrite).
- **Scope:** Applies to `~/.buddy/` (global config). Per-instance (`rootDir`) changes use runtime backward compat — the app never migrates user repos.
- **Silent:** No user interaction. Runs before UI/session start.

**Acceptance criteria:**

- [x] Fresh install (no `config.json`) deploys bundled content and writes `last_app_version`
- [x] Semver bump redeploys `prompts/` and `docs/` and updates `last_app_version`
- [x] Matching semver is a no-op (user-customized prompt edits in `~/.buddy/prompts/` preserved until next bump)
- [x] No `~/.buddy/version` integer file written or read

### 4.10 Housekeeping (NFR-MAINT)

| ID | Requirement |
|----|-------------|
| NFR-MAINT-01 | Delete `.buddy/logs/*.jsonl` session event logs older than 7 days (configurable via `SESSION_LOG_RETENTION_DAYS` in `shared/defaults.ts`). Run on app boot or heartbeat housekeeping. Episodic value is already in daily logs after reflect/consolidation; raw JSONL is debug-only. |
| NFR-MAINT-02 | Prune forked session files in `.buddy/reflect-sessions/` on the same housekeeping pass, keeping a bounded recent window. Nothing pruned them before: one fork is created per session and per checkpoint, each holding the **full conversation transcript** in plain text, and they accumulated indefinitely (verified on a live instance: 5 files, 168 KB, largest 107 KB, after two days of use). NFR-REL-02 justifies keeping recent forks for manual recovery; it does not justify keeping every conversation forever. The reasoning of NFR-MAINT-01 applies with more force here, because the content is the conversation itself rather than an event log. |

### 4.11 Testing Discipline (NFR-TEST)

| ID | Requirement |
|----|-------------|
| NFR-TEST-01 | Every FR with an input surface — a path, a URL, file content, or LLM output — carries at least one Gherkin scenario driving hostile or malformed input, not only the happy path. A feature is not `done` until that scenario exists and passes. |

**Why this exists.** The July 2026 external review found a path traversal
(`resolveLocalPathForOpen`) that had survived 162 green scenarios. The cause was
structural, not careless: the suite mirrors the spec, and the spec described
intent — what should happen when the user does the right thing. Nothing described
what happens when input is crafted, malformed, or hostile. Buddy ingests untrusted
web content and renders agent-authored output, so "the input is well-formed" is not
a safe default assumption anywhere near a path, a URL, or the DOM.

**What counts as an adversarial scenario:** traversal segments (`..`), absolute
paths, `file://` URLs, unexpected extensions, private/loopback network targets,
raw HTML in markdown, oversized payloads, and — where a capability has been
deliberately withdrawn — a scenario asserting it stays withdrawn.

---

## 5. Phase 0 — Architecture PoC

**Goal:** Validate that Tauri + Pi SDK streaming works end-to-end.

**Exact scope:**
- Streaming chat via `session.subscribe()` in Node.js worker
- Chat window with message bubbles (user + assistant, plain text)
- Input bar with send + abort
- Basic error handling (worker crash → error message + restart option)
- Dark/light mode following system

**Excluded:** Memory, personalization, persistence, templates, permissions,
git operations, tool call rendering, thinking blocks, markdown rendering.

**Success criteria:**
- User sends a message → streaming response renders token-by-token → abort works
- Worker crash recovers gracefully with user-visible error
- App respects OS color scheme

**Spike items to verify during Phase 0:**
- Pi event names: confirm `agent_start`, `agent_end`, `message_update`, `tool_execution_start/end`, `compaction_start/end`
- `session.abort()` behavior mid-stream
- kkrpc bidirectional RPC through `tauri-plugin-js`
- Worker startup time and memory footprint

---

## 6. Phase 1 — MVP

**Goal:** Validate "it remembers" — the core promise.

**Exact scope (building on Phase 0):**
- First-run wizard (location, provider, API key, model)
- Deterministic buddy setup (directories, templates, git init, Pi config)
- Agent-driven personalization (first conversation)
- Import existing instance (point to repo with `agent_brain/`)
- Reflect: forked session + background child process (full context LLM reflect)
- Fresh session every launch (`SessionManager.create`; continuity via file memory)
- Deferred item surfacing on app start (session-start context message, FR-PROMPT-02)
- System prompt assembly (agents-base + AGENTS.md + SOUL.md + USER.md + date — episodic content via FR-PROMPT-02/04)
- Permission layer: Zone 1 always allow (with identity confirmation), everything else confirms in chat
- Drag & drop / attach for file ingest (markdown/plain text/images)
- Auto-commit after agent writes
- Git invisible to user
- `logs/index.md` rebuild on reflect complete

**Success criteria:**
User installs → completes wizard → talks to buddy → closes app → reopens →
buddy remembers the conversation, knows their name, surfaces any pending reminders.

**Explicitly excluded from Phase 1 and why:**
- System tray (window close = quit; daemon is Phase 4)
- OS notifications for deferred items (FR-DEFERRED-03; heartbeat check is Phase 2)
- Cost visibility (Phase 2+)
- Git sync (Phase 3+)

---

## 7. Testing Strategy

### 7.1 Unit-testable modules (deterministic, no LLM)

| Module | What to test |
|--------|-------------|
| Permission layer | Zone classification, path matching, denylist enforcement, identity file detection, `extractPath()` across tool types (`read`, `write`, `ls`, `find`, `grep`) |
| Frontmatter parser/writer | Parse valid frontmatter, handle missing fields, handle corruption, preserve body content, update single fields |
| Deferred parser | Date extraction from markdown, due-date comparison, overdue detection, malformed entry handling |
| Scheduler counters | Threshold evaluation, cascade depth determination, counter advancement, `hasNewContent` via git diff |
| Date formatting | ISO day strings, relative date helpers (`addDays`) |
| Hebbian tracker | Access counting, session dedup, exclusion list, queue/flush cycle, frontmatter field update |
| Git sync logic | Conflict detection, retry on non-fast-forward, stale lock detection |
| Consolidation cascade | Ordering of depths, counter reset on success, no advancement on failure |
| System prompt assembly | File concatenation order, deferred item injection, date formatting, missing file handling |

### 7.2 Integration tests (Pi SDK interaction)

| Test area | What to verify |
|-----------|---------------|
| Session creation | `createAgentSession()` with `excludeTools: ["bash"]` produces a session with file tools only |
| Event streaming | `session.subscribe()` emits expected event types in correct order |
| Hook chaining | Custom `beforeToolCall` chains with Pi extension hooks; Hebbian uses `tool_execution_end` via `session.subscribe()` |
| Session fork for reflect | `SessionManager.forkFrom()` produces a valid fork for background reflect without touching the live session |
| Maintenance session | Separate session for consolidation doesn't interfere with the live session |

### 7.3 E2E tests (full user flows)

| Flow | Steps |
|------|-------|
| Fresh install | Launch → wizard → setup → personalization → chat → close → reopen → continuity confirmed |
| Import instance | Launch → wizard → point to existing repo → chat → agent has prior knowledge |
| Reflect cycle | Chat → close → background reflect runs → reopen → log entry complete |
| Permission check | Chat → agent tries to read external file → permission prompt appears → user approves → agent reads |
| File ingest | Drag file onto chat → send message → agent reads and discusses file content |

### 7.4 Eval tests (LLM output quality)

| Eval | Criteria |
|------|----------|
| Reflect completeness | Does the reflect capture key decisions, tasks, and context from the session? Scored against a rubric. |
| Consolidation quality | Does depth-1 produce meaningful synthesis? Does depth-2 identify patterns? |
| Personalization | Does the agent extract name, language, and preferences from a first conversation? Verified by checking USER.md content. |
| Routing accuracy | Does the agent write user tasks to `user/` and learned knowledge to `agent_brain/`? |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **buddy** | The personal assistant system |
| **buddy directory** | The git-backed folder containing the agent's memory (`agent_brain/`, `user/`, `logs/`) |
| **Pi** | The coding agent framework (by Anthropic) used as a library via its SDK |
| **Worker** | The Node.js process (managed by `tauri-plugin-js`) that runs Pi and all backend logic |
| **kkrpc** | Type-safe bidirectional RPC library used for frontend↔worker communication |
| **Consolidation** | Automated memory organization process, parameterized by depth (0–3) |
| **Consolidation depth** | Scope of a consolidation run: 0=reflect (session encoding), 1=daily synthesis, 2=weekly calibration, 3=monthly pruning |
| **Cascade** | When a higher-depth consolidation triggers lower depths first if they haven't been run |
| **Hebbian tracking** | Code-enforced file access counting (`access_count` / `last_accessed` in frontmatter) — drives promotion/demotion of knowledge |
| **Reflect** | The encoding step: capturing what happened in a session into the daily log via a forked LLM call with full conversation context |
| **Heartbeat** | Worker-side `setInterval` that checks deferred items and evaluates consolidation triggers |
| **Zone 1** | Trust zone: the buddy directory — full access, no prompts (except identity files) |
| **Zone 2** | Trust zone: user-designated external paths — silent reads, confirmed writes |
| **Zone 3** | Trust zone: everything else — all access requires user confirmation |
| **Denylist** | Hardcoded paths never accessible by the agent (`~/.ssh/`, `~/.gnupg/`, etc.) |
| **agents-base.md** | Universal system prompt base (`~/.buddy/prompts/agents-base.md`) — defines tool capabilities, automatic behaviors, and agent limits. App-managed, updated with the app. |
| **AGENTS.md** | Instance-specific behavioral rules in rootDir — skills, routing conventions, active context. Works as a standalone fallback when the repo is opened in Cursor or Claude Code |
| **SOUL.md** | Agent character definition — stable, rarely modified, changes require user confirmation |
| **USER.md** | User profile — updated as the agent learns about the user. Zone 1 (silent allow); only SOUL.md requires confirmation |
| **Deferred queue** | Items in `agent_brain/deferred.md` with dates — parsed by code, surfaced by heartbeat or on app start |
| **Maintenance lock** | A lock file (`.buddy/maintenance.lock`) preventing concurrent consolidation operations |
| **Session-allowed paths** | Paths implicitly granted read access for the current session (from user messages or file drops) |
