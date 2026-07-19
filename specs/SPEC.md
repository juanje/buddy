---
created: 2026-07-19
---

# AB App — Functional & Non-Functional Specification

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
    ├── Hebbian tracker (afterToolCall hook)
    ├── Heartbeat scheduler (setInterval)
    └── Consolidation runner (separate Pi session)
    │
    ▼
AB File System (git repo)
    ├── AGENTS.md (portable behavioral rules)
    ├── agent_brain/ (agent's learned knowledge)
    ├── user/ (user's tasks, drafts, journal)
    └── logs/ (session records)
```

**Key patterns:**
- `kkrpc` for frontend↔worker communication (type-safe, bidirectional)
- `excludeTools: ["bash"]` — file operations only, no shell
- Hook chaining on `beforeToolCall` / `afterToolCall` for permissions and Hebbian
- `DefaultResourceLoader` with assembled system prompt at session start
- Separate Pi session for maintenance (consolidation never touches live session)

---

## 3. Functional Requirements

### 3.1 Chat (FR-CHAT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-CHAT-01 | Streaming message display | 0 |
| FR-CHAT-02 | User input with send | 0 |
| FR-CHAT-03 | Abort generation | 0 |
| FR-CHAT-04 | Markdown rendering in assistant messages | 3 |
| FR-CHAT-05 | Thinking block display (collapsible) | 3 |
| FR-CHAT-06 | Tool call display (expandable cards) | 3 |
| FR-CHAT-07 | Auto-scroll with manual override | 0 |

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
- **Then** thinking appears in a collapsible section above the response text, collapsed by default

**FR-CHAT-06 — Tool call display**

- **Given** the agent executes tool calls during a response
- **When** tool events arrive (`tool_execution_start`, `tool_execution_end`)
- **Then** each tool call appears as an expandable card showing tool name and result

**FR-CHAT-07 — Auto-scroll with manual override**

- **Given** new content is streaming into the chat
- **When** the user has NOT scrolled up
- **Then** the view auto-scrolls to the latest content
- **But when** the user has scrolled up manually
- **Then** auto-scroll pauses and a "scroll to bottom" button appears

### 3.2 First-Run / Onboarding (FR-SETUP)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SETUP-01 | First-run detection | 1 |
| FR-SETUP-02 | Language selection | 1 |
| FR-SETUP-03 | Welcome screen | 1 |
| FR-SETUP-04 | Location picker | 1 |
| FR-SETUP-05 | Provider authentication | 1 |
| FR-SETUP-06 | Model selection | 1 |
| FR-SETUP-07 | Personalization form (name + about) | 1 |
| FR-SETUP-08 | Deterministic AB directory setup | 1 |
| FR-SETUP-09 | First conversation with warm handoff | 1 |
| FR-SETUP-10 | Import existing instance | 1 |

**FR-SETUP-01 — First-run detection**

- **Given** the app launches
- **When** no AB directory is configured in `~/.ab-app/config.json`
- **Then** the setup wizard is shown instead of the chat view

**FR-SETUP-02 — Language selection**

- **Given** the setup wizard starts
- **When** the user selects their preferred language
- **Then** the entire wizard UI switches to that language
- **And** the language is stored and used for all subsequent UI and agent replies

**FR-SETUP-03 — Welcome screen**

- **Given** the user has selected a language
- **When** the welcome step loads (in the user's language)
- **Then** a brief explanation of what AB is and what it does is shown
- **And** a "Continue" button proceeds to the next step

**FR-SETUP-04 — Location picker**

- **Given** the user is on the location step of the wizard
- **When** they accept the default (`~/my-ab`) or choose a custom path
- **Then** the path is validated (doesn't exist or is empty) and stored

**FR-SETUP-05 — Provider authentication**

- **Given** the user is on the provider step
- **When** they select a provider (Anthropic, OpenAI, Google, or OpenAI-compatible)
- **Then** an OAuth "Sign in" button appears as the primary option
- **And** an "I have an API key" link shows the key input as a secondary option
- **And (OAuth path)** clicking "Sign in" opens the browser for OAuth authentication
- **And (OAuth path)** tokens are stored in `~/.pi/agent/auth.json` upon successful login
- **And (API key path)** the key is validated with a test API call before proceeding
- **And (API key path)** the key is stored in `~/.pi/agent/auth.json` with restrictive file permissions

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

**FR-SETUP-08 — Deterministic AB directory setup**

- **Given** the user completes the wizard form
- **When** setup runs
- **Then** the full directory structure is created (`agent_brain/`, `user/`, `logs/`)
- **And** templates are copied and USER.md is populated with the name (and About if provided) — no placeholders remain
- **And** Pi settings are written (`.pi/settings.json`) with the selected provider/model
- **And** git is initialized with an initial commit
- **And** no LLM call is made during this phase

**FR-SETUP-09 — First conversation with warm handoff**

- **Given** the AB directory is created and configured
- **When** the first session starts
- **Then** the user's personalization data (name, about) is injected as an initial user message to the agent (not shown in the UI) so the agent already knows who they are
- **And** the agent's first visible response is a warm welcome by name, with brief tips on how to use it
- **And** during this first conversation, identity file writes (USER.md) do NOT trigger permission prompts — the agent is expected to enrich the profile
- **And** from the second session onward, normal permission rules apply

**FR-SETUP-10 — Import existing instance**

- **Given** the location picker step shows an existing AB directory (one with `agent_brain/`)
- **When** the user confirms import
- **Then** the app adopts the existing directory without modifying its content
- **And** platform artifacts (`.cursor/`, `.codex/`) are ignored
- **And** the wizard skips personalization (existing instance already has data)

**Note:** Prerequisites (git installed) are checked as a gate before the wizard
proceeds past the language step. If git is missing, a clear message with
platform-specific install instructions is shown and setup cannot continue.

### 3.3 Session Management (FR-SESSION)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SESSION-01 | Fresh session on every launch | 1 |
| FR-SESSION-02 | (removed — every launch is inherently fresh) | — |
| FR-SESSION-03 | Session end on app close | 1 |

**FR-SESSION-01 — Fresh session on every launch**

- **Given** the app starts and a configured AB directory exists
- **When** the worker initializes
- **Then** a new Pi session is created via `SessionManager.create()`
- **And** the system prompt provides all continuity (assembled from identity files, logs, deferred)
- **And** no prior conversation history is carried over (memory is in files, not chat context)

**FR-SESSION-02** — *(removed: with fresh sessions on every launch, there is no
"current session" to end and no separate "new session" action needed)*

**FR-SESSION-03 — Session end on app close**

- **Given** the user closes the app window or quits
- **When** the shutdown sequence runs
- **Then** a factual skeleton is extracted from session events (deterministic, no LLM)
- **And** the skeleton is saved and the session is marked "reflect pending"
- **And** `logs/index.md` is rebuilt from per-session frontmatter (code, no LLM)

### 3.4 Reflect (FR-REFLECT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-REFLECT-01 | Factual skeleton capture on session end | 1 |
| FR-REFLECT-02 | Catch-up reflect on app start | 1 |
| FR-REFLECT-03 | Incremental mid-session reflect (N turns + pre-compaction) | 1 |

**FR-REFLECT-01 — Factual skeleton capture**

- **Given** a session ends (app close or new session)
- **When** the worker runs shutdown
- **Then** a skeleton is saved containing: timestamps, files read/written, tool calls, git commits
- **And** the skeleton is written without any LLM call (pure event extraction)
- **And** the session is marked "reflect pending" for later LLM processing

**FR-REFLECT-02 — Catch-up reflect on start**

- **Given** the app starts and pending reflects exist from previous sessions
- **When** no user streaming is active
- **Then** a maintenance Pi session processes pending reflects (oldest first, max 3)
- **And** the LLM reads the skeleton + raw session and writes: Decisions, Lessons, Context, Open threads
- **And** the reflect is marked complete and the maintenance session is disposed
- **And** the maintenance lock prevents concurrent reflect/consolidation

**FR-REFLECT-03 — Incremental mid-session reflect**

- **Given** a session has been running for N messages (configurable, default 15)
- **Or given** Pi emits a `compaction_start` event (context window about to be compressed)
- **When** the worker detects the threshold or the compaction event
- **Then** a lightweight reflect runs (encoding, not deep analysis) capturing decisions, tasks, and context from the segment
- **And** the snapshot is written to disk immediately (survives crashes)
- **And** a cheaper model or lower thinking level is used
- **And** the full session-end reflect incorporates the incremental snapshots
- **Note:** The compaction trigger is critical — Pi discards context during compaction. Anything not reflected before that point is lost to the agent's long-term memory.

### 3.5 Permission Layer (FR-PERM)

| ID | Description | Phase |
|----|-------------|-------|
| FR-PERM-01 | Zone 1: AB home full access | 1 |
| FR-PERM-02 | Identity file write confirmation | 1 |
| FR-PERM-03 | Zone 3: confirm all outside access | 1 |
| FR-PERM-04 | Hardcoded denylist | 1 |
| FR-PERM-05 | Implicit permission from user messages | 2 |
| FR-PERM-06 | Zone 2: user-designated paths | 2 |
| FR-PERM-07 | Permission prompt in chat | 1 |

**FR-PERM-01 — Zone 1: AB home**

- **Given** the agent calls a file tool on a path inside the AB directory
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

- **Given** the agent calls a file tool on a path outside the AB directory
- **When** the path is not on the denylist
- **Then** the user is shown a permission prompt with options (allow once, deny)
- **And** the agent pauses on that tool call until the user responds

**FR-PERM-04 — Hardcoded denylist**

- **Given** the agent attempts to access `~/.ssh/*`, `~/.gnupg/*`, `~/.aws/*`, `**/.env`, or `**/auth.json`
- **When** the permission layer evaluates the path
- **Then** access is denied silently — no user prompt, no override possible

**FR-PERM-05 — Implicit permission from messages**

- **Given** the user mentions a file path in their chat message
- **When** the agent subsequently reads that path
- **Then** read access is granted silently for the current session

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
| FR-INGEST-01 | Drag and drop files onto chat | 1 |
| FR-INGEST-02 | Attach button | 1 |
| FR-INGEST-03 | Dropped file implicit permission | 1 |
| FR-INGEST-04 | Supported formats | 1 |

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
- **When** it is markdown or plain text
- **Then** the agent reads and discusses it normally
- **But when** it is PDF, DOCX, or another unsupported format
- **Then** a friendly message suggests exporting to text

### 3.7 Deferred Queue (FR-DEFERRED)

| ID | Description | Phase |
|----|-------------|-------|
| FR-DEFERRED-01 | Surface due items on app start | 1 |
| FR-DEFERRED-02 | Heartbeat periodic check | 2 |
| FR-DEFERRED-03 | OS notification for due items | 2 |

**FR-DEFERRED-01 — Surface on start**

- **Given** `agent_brain/deferred.md` contains items with dates
- **When** the app starts
- **Then** due and overdue items are parsed and injected into the system prompt
- **And** the agent is aware of them from the first message

**FR-DEFERRED-02 — Heartbeat check**

- **Given** the heartbeat scheduler is running (default: every 30 minutes)
- **When** a tick fires
- **Then** `deferred.md` is parsed and due items are detected
- **And** the frontend is notified via `onDeferredDue()`

**FR-DEFERRED-03 — OS notification**

- **Given** the heartbeat detects due deferred items
- **When** the frontend receives the notification
- **Then** an OS-level notification fires via `tauri-plugin-notification`
- **And** clicking the notification focuses the app window

### 3.8 Consolidation (FR-CONSOL)

| ID | Description | Phase |
|----|-------------|-------|
| FR-CONSOL-01 | Usage-based trigger evaluation | 2 |
| FR-CONSOL-02 | Cascade ordering | 2 |
| FR-CONSOL-03 | Separate maintenance session | 2 |
| FR-CONSOL-04 | Lock management | 2 |
| FR-CONSOL-05 | Idle-aware scheduling | 2 |
| FR-CONSOL-06 | Run journal | 2 |

**FR-CONSOL-01 — Usage-based triggers**

- **Given** sessions have completed since the last consolidation
- **When** the heartbeat evaluates counters (sessions since last depth-1, depth-1 runs since last depth-2, etc.)
- **And** thresholds are met and new content exists (verified via `git diff`)
- **Then** consolidation is triggered at the appropriate depth

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

**FR-CONSOL-04 — Lock management**

- **Given** a consolidation or catch-up reflect is about to run
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
- **Then** an entry is appended to `.ab-app/consolidation-log.json` with timestamp, depth, duration, and status

### 3.9 Hebbian Tracking (FR-HEBB)

| ID | Description | Phase |
|----|-------------|-------|
| FR-HEBB-01 | Intercept read tool calls | 2 |
| FR-HEBB-02 | Frontmatter update | 2 |
| FR-HEBB-03 | Exclusions | 2 |
| FR-HEBB-04 | Lazy commit | 2 |

**FR-HEBB-01 — Intercept reads**

- **Given** the agent calls the `read` tool on a file inside the AB directory
- **When** `afterToolCall` fires and `ctx.isError` is false
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
| FR-PROMPT-01 | Assembly from files | 1 |
| FR-PROMPT-02 | Session-start enrichment | 1 |

**FR-PROMPT-01 — Assembly**

- **Given** a session is starting
- **When** the system prompt is built
- **Then** it includes: AGENTS.md, SOUL.md, USER.md, due deferred items, current date/time
- **And** it is passed to Pi via `DefaultResourceLoader({ systemPrompt })`

**FR-PROMPT-02 — Session-start enrichment**

- **Given** the system prompt is assembled
- **When** deferred items are due or overdue
- **Then** they are formatted and included in the prompt so the agent surfaces them proactively

### 3.11 Git Operations (FR-GIT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-GIT-01 | Auto-commit after agent writes | 1 |
| FR-GIT-02 | Git invisible to user | 1 |
| FR-GIT-03 | Index rebuild on session end | 1 |

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

- **Given** a session ends
- **When** the shutdown sequence runs
- **Then** `logs/index.md` is rebuilt from per-session file frontmatter
- **And** the rebuild is deterministic (code, no LLM)

### 3.12 Settings / Configuration (FR-SETTINGS)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SETTINGS-01 | Provider and model stored in Pi settings | 1 |
| FR-SETTINGS-02 | Settings UI | 3 |
| FR-SETTINGS-03 | Model switching from UI | 3 |
| FR-SETTINGS-04 | Language switching from settings | 3 |

**FR-SETTINGS-01 — Pi settings**

- **Given** the user configured a provider and model during setup
- **When** the session starts
- **Then** Pi reads from `.pi/settings.json` and uses the configured model

**FR-SETTINGS-02 — Settings UI**

- **Given** the user opens settings (Cmd/Ctrl+, or menu/header button)
- **When** the settings modal appears
- **Then** they can view/edit: language, provider, model, AB directory path
- **And** changes persist to `.pi/settings.json` and app config

**FR-SETTINGS-03 — Model switching**

- **Given** the user changes the model in settings
- **When** they confirm the change
- **Then** `session.setModel()` is called and subsequent messages use the new model

**FR-SETTINGS-04 — Language switching**

- **Given** the user changes language in settings
- **When** they confirm
- **Then** the UI switches immediately and the preference is stored

### 3.13 Cost Visibility (FR-COST)

| ID | Description | Phase |
|----|-------------|-------|
| FR-COST-01 | Per-message cost | 2 |
| FR-COST-02 | Session total | 2 |
| FR-COST-03 | Monthly total | 3 |

**FR-COST-01 — Per-message cost**

- **Given** the agent completes a response
- **When** the `message_end` event includes `usage` data
- **Then** token count and cost are available on hover or in message details

**FR-COST-02 — Session total**

- **Given** cost data accumulates during a session
- **When** the user checks the status bar
- **Then** the accumulated session cost is displayed

**FR-COST-03 — Monthly total**

- **Given** the user opens settings
- **When** cost history is available
- **Then** a monthly total is displayed

### 3.14 AB Brain Template (FR-BRAIN)

The template is the **core content** that makes AB behave as AB. Without correct
templates, the app is a generic chatbot with a git repo. This area has its own
detailed specification: [specs/BRAIN-SPEC.md](BRAIN-SPEC.md).

| ID | Description | Phase |
|----|-------------|-------|
| FR-BRAIN-01 | AGENTS.md provides behavioral rules that produce AB behavior | 1 |
| FR-BRAIN-02 | SOUL.md defines character and first-session personalization flow | 1 |
| FR-BRAIN-03 | USER.md placeholder is correctly populated by agent in first conversation | 1 |
| FR-BRAIN-04 | Consolidation skills produce meaningful summaries when invoked | 2 |
| FR-BRAIN-05 | Observation pipeline captures and promotes patterns | 2 |

**FR-BRAIN-01 — AGENTS.md behavioral rules**

- **Given** a fresh AB instance with only the template content
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

**Note:** FR-BRAIN-01 through 03 are Phase 1 prerequisites — the app cannot
ship without templates that produce correct behavior. These are developed in
parallel with the technical scaffolding and tested via conversation eval.
Full specification in [specs/BRAIN-SPEC.md](BRAIN-SPEC.md).

### 3.15 UI Shell (FR-SHELL)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SHELL-01 | App header bar with session controls | 3 |
| FR-SHELL-02 | Explicit end-session button | 3 |
| FR-SHELL-03 | About / app info panel | 3 |
| FR-SHELL-04 | Attach button in input bar | 1 |

**FR-SHELL-01 — App header bar**

- **Given** the chat view is active
- **When** the user looks at the top of the window
- **Then** a minimal header shows the app name and action icons (settings, about, end session)
- **And** the header does not waste vertical space (single line, compact)

**FR-SHELL-02 — End-session button**

- **Given** the user wants to close the session explicitly
- **When** they click the end-session icon in the header
- **Then** the shutdown sequence runs (skeleton, commit, reflect) and the window closes
- **Note:** More discoverable than relying on the tiny OS window close button

**FR-SHELL-03 — About panel**

- **Given** the user clicks the about/info icon
- **When** the panel appears
- **Then** it shows: app version, AB directory path, current model, session stats (turns, cost if available)

**FR-SHELL-04 — Attach button**

- **Given** the input bar is active
- **When** the user clicks the attach (paperclip) button
- **Then** a native file picker opens and selected files appear as chips (same as FR-INGEST-02)
- **Note:** This is the same as FR-INGEST-02 but scoped to the input bar UX component

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

### 3.17 AB Self-Documentation (FR-DOCS)

| ID | Description | Phase |
|----|-------------|-------|
| FR-DOCS-01 | Self-documentation KB available for agent consultation | 3 |
| FR-DOCS-02 | "Help me" / "How do you work?" triggers agent self-explanation | 3 |

**FR-DOCS-01 — Self-documentation KB**

- **Given** the AB directory is set up
- **When** the agent needs to explain what it is, how it works, or what it can do
- **Then** it consults `agent_brain/docs/` — a small set of markdown files covering capabilities, usage tips, and how the memory system works
- **And** these files are NOT loaded at session start (they are referenced in AGENTS.md as "consult on demand when asked")
- **And** the KB is part of the template, shipped with new instances

**FR-DOCS-02 — Self-explanation trigger**

- **Given** the user asks "what can you do?", "how do you work?", "help", or similar
- **When** the agent processes the request
- **Then** it reads relevant docs from `agent_brain/docs/` and synthesizes a natural, context-appropriate answer
- **And** it does not dump the entire KB — it answers what was asked

### 3.18 User Personal Knowledge Base (FR-WIKI)

| ID | Description | Phase |
|----|-------------|-------|
| FR-WIKI-01 | Wiki-style KB for user's personal knowledge | 2 |
| FR-WIKI-02 | Ingest documents into wiki | 2 |
| FR-WIKI-03 | Cross-reference and backlinks | 2 |
| FR-WIKI-04 | Search and retrieve from wiki | 2 |

**FR-WIKI-01 — User personal KB**

- **Given** the AB instance is configured
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

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-01 | First token of a streaming response appears within 2s of the LLM beginning output (network latency excluded) |
| NFR-PERF-02 | App starts and shows the chat view (or wizard) within 3s on a modern machine |
| NFR-PERF-03 | Heartbeat checks (deferred parsing, counter evaluation) complete in <100ms and never block the UI |
| NFR-PERF-04 | Factual skeleton extraction on shutdown completes in <500ms (no LLM call) |

### 4.2 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | No bash or shell tool available to the agent — enforced at session creation via `excludeTools` |
| NFR-SEC-02 | Zone model enforced in `beforeToolCall` hook — no file access bypasses the permission layer |
| NFR-SEC-03 | SOUL.md writes require user confirmation; USER.md writes are silent (agent manages profile freely) |
| NFR-SEC-04 | Hardcoded denylist paths are never accessible, regardless of user confirmation |
| NFR-SEC-05 | API keys stored with restrictive file permissions (mode 600); no credentials inside the AB repo |
| NFR-SEC-06 | The agent cannot modify its own model configuration (`.pi/settings.json` writes blocked) |

### 4.3 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | If the app crashes mid-session, the next start detects the missing reflect and processes it during catch-up |
| NFR-REL-02 | Pending reflect markers survive crashes (written to disk before session dispose) |
| NFR-REL-03 | Lock files include PID and timestamp; stale locks (process dead or >1h) are broken automatically |
| NFR-REL-04 | Failed consolidation runs don't advance counters — the run retries on the next evaluation |
| NFR-REL-05 | Worker crash shows a user-friendly error with a restart option, not a stack trace |

### 4.4 Portability

| ID | Requirement |
|----|-------------|
| NFR-PORT-01 | All memory state is in human-readable files (markdown + YAML frontmatter) — no SQLite, no binary formats |
| NFR-PORT-02 | The AB repo works in Cursor or Claude Code with basic functionality via AGENTS.md as fallback |
| NFR-PORT-03 | The app never overwrites AGENTS.md — user customizations are preserved |
| NFR-PORT-04 | Platform artifacts (`.cursor/`, `.codex/`, `.claude/`) in imported instances are ignored |

### 4.5 Privacy

| ID | Requirement |
|----|-------------|
| NFR-PRIV-01 | Raw Pi sessions stored outside the AB repo (Pi's default `~/.pi/agent/sessions/`) — not synced or pushed |
| NFR-PRIV-02 | No telemetry, analytics, or usage data sent anywhere |
| NFR-PRIV-03 | All data stored locally; cloud only for LLM API calls |

### 4.6 Accessibility

| ID | Requirement |
|----|-------------|
| NFR-ACC-01 | Dark and light mode following system preference (`prefers-color-scheme`) |
| NFR-ACC-02 | Keyboard shortcuts for all primary actions (send, abort, new session, settings) |
| NFR-ACC-03 | Semantic HTML in chat messages for screen reader compatibility |

### 4.7 Internationalization (i18n)

| ID | Requirement |
|----|-------------|
| NFR-I18N-01 | All UI strings externalized in a locale module (no hardcoded text in components) |
| NFR-I18N-02 | Language selected by the user during setup applies to UI and is passed to the agent |
| NFR-I18N-03 | MVP ships with Spanish and English; adding a language requires only a new locale file |
| NFR-I18N-04 | The agent replies in the user's language (set in USER.md preferences, injected in system prompt) |

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
- `SessionManager.continueRecent()` return shape (async? nullable?)
- Pi event names: confirm `agent_start`, `agent_end`, `message_update`, `tool_execution_start/end`, `compaction_start/end`
- `session.abort()` behavior mid-stream
- kkrpc bidirectional RPC through `tauri-plugin-js`
- Worker startup time and memory footprint

---

## 6. Phase 1 — MVP

**Goal:** Validate "it remembers" — the core promise.

**Exact scope (building on Phase 0):**
- First-run wizard (location, provider, API key, model)
- Deterministic AB setup (directories, templates, git init, Pi config)
- Agent-driven personalization (first conversation)
- Import existing instance (point to repo with `agent_brain/`)
- Reflect: factual skeleton on session end + catch-up on start
- Session resume via `SessionManager.continueRecent()`
- Deferred item surfacing on app start (in system prompt)
- System prompt assembly (AGENTS.md + SOUL.md + USER.md + deferred + date)
- Permission layer: Zone 1 always allow (with identity confirmation), everything else confirms in chat
- Drag & drop / attach for file ingest (markdown/plain text)
- Auto-commit after agent writes
- Git invisible to user
- `logs/index.md` rebuild on session end

**Success criteria:**
User installs → completes wizard → talks to AB → closes app → reopens →
AB remembers the conversation, knows their name, surfaces any pending reminders.

**Explicitly excluded from Phase 1 and why:**
- System tray (window close = quit; daemon is Phase 4)
- Heartbeat/scheduler (no periodic checks; consolidation is Phase 2)
- Hebbian tracking (Phase 2 — needs heartbeat for promotion cycles)
- Tool call rendering as cards (shown as plain text; visual polish is Phase 3)
- Thinking blocks as collapsible (shown inline; Phase 3)
- Markdown rendering (Phase 3)
- Settings UI (configure via `.pi/settings.json` directly; Phase 3)
- Model switching from UI (Phase 3)
- Cost visibility (Phase 2+)
- Git sync (Phase 3+)
- Implicit path permission from messages (Phase 2; MVP uses simple confirm-all for Zone 3)
- Zone 2 persistent paths (Phase 2)

---

## 7. Testing Strategy

### 7.1 Unit-testable modules (deterministic, no LLM)

| Module | What to test |
|--------|-------------|
| Permission layer | Zone classification, path matching, denylist enforcement, identity file detection, `extractPath()` across tool types (`read`, `write`, `ls`, `find`, `grep`) |
| Frontmatter parser/writer | Parse valid frontmatter, handle missing fields, handle corruption, preserve body content, update single fields |
| Deferred parser | Date extraction from markdown, due-date comparison, overdue detection, malformed entry handling |
| Scheduler counters | Threshold evaluation, cascade depth determination, counter advancement, `hasNewContent` via git diff |
| Date resolution | Night-owl date logic (`resolveSubjectiveDate`), relative date mapping, timezone handling |
| Hebbian tracker | Access counting, session dedup, exclusion list, queue/flush cycle, frontmatter field update |
| Git sync logic | Conflict detection, retry on non-fast-forward, stale lock detection |
| Consolidation cascade | Ordering of depths, counter reset on success, no advancement on failure |
| System prompt assembly | File concatenation order, deferred item injection, date formatting, missing file handling |

### 7.2 Integration tests (Pi SDK interaction)

| Test area | What to verify |
|-----------|---------------|
| Session creation | `createAgentSession()` with `excludeTools: ["bash"]` produces a session with file tools only |
| Event streaming | `session.subscribe()` emits expected event types in correct order |
| Hook chaining | Custom `beforeToolCall` / `afterToolCall` are called alongside Pi extension hooks |
| Session resume | `SessionManager.continueRecent()` restores conversation context |
| Maintenance session | Separate session for consolidation doesn't interfere with the live session |

### 7.3 E2E tests (full user flows)

| Flow | Steps |
|------|-------|
| Fresh install | Launch → wizard → setup → personalization → chat → close → reopen → continuity confirmed |
| Import instance | Launch → wizard → point to existing repo → chat → agent has prior knowledge |
| Reflect cycle | Chat → close → reopen → catch-up reflect runs → log entry exists |
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
| **AB** | Agentic Buddy — the personal assistant system |
| **AB directory** | The git-backed folder containing the agent's memory (`agent_brain/`, `user/`, `logs/`) |
| **Pi** | The coding agent framework (by Anthropic) used as a library via its SDK |
| **Worker** | The Node.js process (managed by `tauri-plugin-js`) that runs Pi and all backend logic |
| **kkrpc** | Type-safe bidirectional RPC library used for frontend↔worker communication |
| **Consolidation** | Automated memory organization process, parameterized by depth (0–3) |
| **Consolidation depth** | Scope of a consolidation run: 0=reflect (session encoding), 1=daily synthesis, 2=weekly calibration, 3=monthly pruning |
| **Cascade** | When a higher-depth consolidation triggers lower depths first if they haven't been run |
| **Hebbian tracking** | Code-enforced file access counting (`access_count` / `last_accessed` in frontmatter) — drives promotion/demotion of knowledge |
| **Reflect** | The encoding step: capturing what happened in a session into the log. Two layers: factual skeleton (code) + interpretive summary (LLM) |
| **Factual skeleton** | Deterministic extraction of session events (files, tools, timestamps) — written without LLM, survives crashes |
| **Heartbeat** | Worker-side `setInterval` that checks deferred items and evaluates consolidation triggers |
| **Zone 1** | Trust zone: the AB directory — full access, no prompts (except identity files) |
| **Zone 2** | Trust zone: user-designated external paths — silent reads, confirmed writes |
| **Zone 3** | Trust zone: everything else — all access requires user confirmation |
| **Denylist** | Hardcoded paths never accessible by the agent (`~/.ssh/`, `~/.gnupg/`, etc.) |
| **AGENTS.md** | Portable behavioral rules in the repo root — works as a fallback when the repo is opened in Cursor or Claude Code |
| **SOUL.md** | Agent character definition — stable, rarely modified, changes require user confirmation |
| **USER.md** | User profile — updated as the agent learns about the user, changes require user confirmation |
| **Deferred queue** | Items in `agent_brain/deferred.md` with dates — parsed by code, surfaced by heartbeat or on app start |
| **Maintenance lock** | A lock file (`.ab-app/maintenance.lock`) preventing concurrent consolidation or catch-up reflect operations |
| **Session-allowed paths** | Paths implicitly granted read access for the current session (from user messages or file drops) |
