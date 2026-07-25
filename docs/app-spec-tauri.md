---
last_accessed: 2026-07-18
access_count: 1
created: 2026-07-18
---

# AB App — Tauri + Pi SDK Technical Specification

Detailed specification for a native cross-platform app that uses Pi's SDK
directly (as a library) within a managed Node.js worker. The app is a thin
UX layer — all agent logic, tools, sessions, and memory management live in
Pi + extensions + AB file system.

## Architecture Overview

The key insight: `tauri-plugin-js` manages a Node.js worker process where we
import Pi as a library (`createAgentSession()`). No subprocess-within-subprocess,
no JSONL protocol parsing. The Rust layer is minimal — only window, tray, and
notifications. All logic lives in TypeScript.

```
┌──────────────────────────────────────────────────────────────┐
│  Tauri App                                                   │
│                                                              │
│  ┌──────────────────────────────────────────┐                │
│  │  Frontend (System Webview)               │                │
│  │  Svelte • Chat UI                        │                │
│  │  - Message bubbles (user/assistant)      │                │
│  │  - Streaming text rendering              │                │
│  │  - Input bar + send/abort                │                │
│  │  - Status bar (model, state)             │                │
│  └────────────────┬─────────────────────────┘                │
│                   │ kkrpc (type-safe bidirectional RPC)      │
│  ┌────────────────▼─────────────────────────┐                │
│  │  Node.js Worker (TypeScript)             │                │
│  │  - Pi SDK: createAgentSession()          │                │
│  │  - session.subscribe() → stream events   │                │
│  │  - Heartbeat scheduler (setInterval)     │                │
│  │  - deferred.md reader (fs.readFile)      │                │
│  │  - Session lifecycle management          │                │
│  └────────────────┬─────────────────────────┘                │
│                   │ (in-process, Pi as npm dependency)       │
│  ┌────────────────▼─────────────────────────┐                │
│  │  Pi Agent (library)                      │                │
│  │  Tools: read, write, edit, ls, find, grep│                │
│  │  (no bash — file operations only)        │                │
│  └────────────────┬─────────────────────────┘                │
│                   │                                          │
│  ┌────────────────┐  ┌──────────────────┐                    │
│  │  Rust Shell    │  │  Tauri plugins   │                    │
│  │  (minimal)     │  │  - notification  │                    │
│  │  - window mgmt │  │  - tray          │                    │
│  │  - plugin-js   │  │  - global hotkey │                    │
│  └────────────────┘  └──────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │  AB File System       │
        │  AGENTS.md / agent_brain / │
        │  user / logs          │
        └───────────────────────┘
```

### Why SDK over RPC


| Concern         | RPC approach                              | SDK approach (chosen)                                    |
| --------------- | ----------------------------------------- | -------------------------------------------------------- |
| Protocol layer  | Rust parses JSONL, bridges to frontend    | None — direct function calls                             |
| Streaming       | Parse `message_update` JSON lines         | `session.subscribe(event => ...)`                        |
| Rust complexity | Moderate (JSONL bridge, scheduler, state) | Minimal (only tauri-plugin-js lifecycle)                 |
| Scheduler       | Tokio timers in Rust                      | `setInterval` in TS (simpler)                            |
| Session control | Indirect JSON commands                    | Direct API: `session.prompt()`, `.steer()`, `.compact()` |
| Language        | Split: Rust logic + TS frontend           | Unified: all logic in TS                                 |
| Pi integration  | Subprocess (process boundary)             | Library import (in-process)                              |


## Component Specification

### 1. Rust Shell (minimal)

The Rust backend does almost nothing. Its sole responsibilities:

- **Window management** — create the webview window, handle resize/close
- **System tray** — native tray icon and menu (Tauri built-in)
- **tauri-plugin-js** — spawn and manage the Node.js worker process
- **tauri-plugin-notification** — fire OS notifications (called from TS via Tauri command)
- **tauri-plugin-global-shortcut** — global hotkeys for quick capture

```rust
// src-tauri/src/main.rs — essentially boilerplate
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_js::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::init())
        .setup(|app| {
            // Create system tray
            // Window config from tauri.conf.json
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

No custom Rust commands needed — all logic flows through the TS worker via kkrpc.

### 2. Node.js Worker — Pi Agent Backend (TypeScript)

The core of the app. A single TypeScript file (~200-300 lines) that:

- Creates a Pi agent session using the SDK
- Exposes an RPC API to the frontend
- Manages the heartbeat scheduler
- Handles session lifecycle

```typescript
// backends/agent-worker.ts
import { createAgentSession, ModelRuntime, SessionManager, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
import { RPCChannel, NodeIo } from "kkrpc";

// Shared API type (used by both frontend and worker)
import type { WorkerAPI, FrontendAPI } from "../shared/api";

// --- Boot (before session) ---
// 1. ensureSchema() — NFR-MIGRATE-01..05 (integer ~/.buddy/version)
// 2. refreshPromptsIfVersionChanged() — NFR-MIGRATE-06 (semver → ~/.buddy/prompts/)
// 3. pruneSessionLogs() — NFR-MAINT-01 (delete .buddy/logs/*.jsonl older than 7 days)

// --- Pi Session Setup ---

const AB_DIR = process.env.AB_DIR || "~/buddy";

const modelRuntime = await ModelRuntime.create();

// System prompt via ResourceLoader (Pi SDK requires this pattern)
const resourceLoader = new DefaultResourceLoader({
    cwd: AB_DIR,
    agentDir: `${homedir()}/.pi/agent`,
    systemPromptOverride: () => assembledSystemPrompt,  // built from AGENTS.md + SOUL + USER + context
});
await resourceLoader.reload();

// Fresh session every launch (E5 decision: continuity via file memory, not session resume)
const sessionManager = SessionManager.create(AB_DIR);

const { session } = await createAgentSession({
    sessionManager,
    modelRuntime,
    resourceLoader,
    excludeTools: ["bash"],  // file-only tool set (security decision)
    tools: ["read", "write", "edit", "grep", "find", "ls"],  // explicit activation (SDK default is only read/write/edit)
    customTools: buildSkillTools(promptsDir),  // FR-SKILL: procedural prompts as callable tools
    cwd: AB_DIR,
});

// --- Hook chaining for permissions + Hebbian tracking ---
// Pi installs extension hooks on agent.beforeToolCall/afterToolCall.
// We chain ours on top (save original, call it after our logic).

const originalBefore = session.agent.beforeToolCall;
session.agent.beforeToolCall = async (ctx, signal) => {
    const permResult = await permissionLayer(ctx);
    if (permResult === "deny") return { block: true, reason: "Permission denied" };
    return originalBefore?.(ctx, signal);
};

// Note: Hebbian tracking uses session.subscribe() on tool_execution_end,
// not afterToolCall (see Hebbian Tracking Layer section below).
// afterToolCall is reserved for extension hooks only.

// --- RPC API exposed to frontend ---

const workerApi: WorkerAPI = {
    async prompt(text: string) {
        await session.prompt(text);
    },

    async abort() {
        await session.abort();
    },

    async steer(text: string) {
        await session.steer(text);
    },

    async setModel(provider: string, modelId: string) {
        const model = await resolveModel(modelRuntime, provider, modelId);
        await session.setModel(model);
    },

    async setThinkingLevel(level: string) {
        session.setThinkingLevel(level);
    },

    async compact() {
        await session.compact();
    },

    async shutdown() {
        await core?.api.shutdown();
        session.dispose();
    },
};

// --- Event streaming to frontend ---

session.subscribe((event) => {
    // Forward all Pi events to frontend via kkrpc
    frontendApi.onAgentEvent(event);
});

// --- Heartbeat scheduler ---

const HEARTBEAT_INTERVAL = 30 * 60 * 1000; // 30 minutes

setInterval(async () => {
    const deferred = await fs.readFile(`${AB_DIR}/agent_brain/deferred.md`, "utf-8");
    const dueItems = parseDeferredItems(deferred).filter(item => isDue(item));
    if (dueItems.length > 0) {
        frontendApi.onDeferredDue(dueItems);
    }
}, HEARTBEAT_INTERVAL);

// --- kkrpc channel setup ---

const io = new NodeIo();
const { channel, api: frontendApi } = await RPCChannel.create<WorkerAPI, FrontendAPI>(
    io, workerApi
);
```

### System Prompt Assembly

The worker builds the system prompt once at session start (not per turn).

**Source layers:**

1. **AGENTS.md** — loaded from the AB repo root. Contains base behavioral rules
   that also serve as fallback for Cursor/Claude Code. The user can edit this
   file directly for customization; the app never overwrites it.
2. **SOUL.md** — character definition, injected verbatim
3. **USER.md** — user profile, injected verbatim
4. **Active context summary** — extracted from CLAUDE.md "Right now" section
   (or equivalent structured file the app maintains)
5. **Deferred items** — due/overdue items from `agent_brain/deferred.md`
6. **Date/time** — current date, day of week, timezone

```typescript
// backends/system-prompt.ts
import { readFile } from "node:fs/promises";

export async function assembleSystemPrompt(abDir: string): Promise<string> {
    const [agentsMd, soul, user, deferred] = await Promise.all([
        readFile(`${abDir}/AGENTS.md`, "utf-8"),
        readFile(`${abDir}/agent_brain/identity/SOUL.md`, "utf-8"),
        readFile(`${abDir}/agent_brain/identity/USER.md`, "utf-8"),
        readFile(`${abDir}/agent_brain/deferred.md`, "utf-8").catch(() => ""),
    ]);

    const dueItems = parseDeferredItems(deferred).filter(isDue);
    const now = new Date();

    return [
        agentsMd,
        "\n## Identity\n",
        soul,
        "\n## User Profile\n",
        user,
        dueItems.length ? `\n## Due reminders\n${formatDueItems(dueItems)}` : "",
        `\n## Session context\nDate: ${now.toLocaleDateString()} (${now.toLocaleDateString("en", { weekday: "long" })})`,
    ].join("\n");
}
```

Passed to Pi at session creation via `DefaultResourceLoader`:

```typescript
const systemPrompt = await assembleSystemPrompt(AB_DIR);
const resourceLoader = new DefaultResourceLoader({
    cwd: AB_DIR,
    agentDir: `${homedir()}/.pi/agent`,
    systemPromptOverride: () => systemPrompt,
});
await resourceLoader.reload();

const { session } = await createAgentSession({
    sessionManager: SessionManager.create(AB_DIR),
    modelRuntime,
    resourceLoader,
    excludeTools: ["bash"],
    tools: ["read", "write", "edit", "grep", "find", "ls"],
    cwd: AB_DIR,
});
```

### Skill Tools (FR-SKILL)

Procedural prompts (process-conversation, triage-inbox) are registered as
custom tools on the Pi session. When the LLM invokes a skill tool, the worker
reads the corresponding file from `~/.buddy/prompts/` and returns its content
as the tool result. The LLM then follows the procedure in-context.

```typescript
// backends/skill-tools.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface SkillDescriptor {
    name: string;
    description: string;
    promptFile: string;
}

const SKILL_REGISTRY: SkillDescriptor[] = [
    {
        name: "process_conversation",
        description: "Reflect on the current conversation: extract decisions, lessons, context, tasks, ideas, and observations. Use when the user asks to save/reflect/capture the session.",
        promptFile: "process-conversation.md",
    },
    {
        name: "triage_inbox",
        description: "Process the GTD inbox: handle captures, review next actions, clean up stale items. Use when the user says 'triage', 'process inbox', or 'what should I work on?'",
        promptFile: "triage-inbox.md",
    },
];

export function buildSkillTools(promptsDir: string) {
    return SKILL_REGISTRY.map((skill) => ({
        name: skill.name,
        description: skill.description,
        inputSchema: { type: "object", properties: {} },
        handler: async () => {
            const content = await readFile(join(promptsDir, skill.promptFile), "utf-8");
            return { result: content };
        },
    }));
}
```

**Why tools instead of file reads:**

- **Single source of truth:** Prompt lives in bundle only — no instance copy to synchronize.
- **Always current:** App update ships new prompts; the LLM always gets the latest version.
- **One call vs two:** LLM calls the tool → gets prompt. No need to first read a file.
- **Discoverable:** The tool description tells the LLM *when* to use it; no need for
  an AGENTS.md "Skills" section listing files.
- **Same prompt for auto and manual:** `reflect-child` loads the same `process-conversation.md`
  that the manual tool returns (FR-SKILL-04).

### 3. Shared API Types (TypeScript)

Type-safe contract between frontend and worker:

```typescript
// shared/api.ts

export interface AgentEvent {
    type: string;
    [key: string]: any;
}

export interface DeferredItem {
    text: string;
    dueDate: string;
}

// Frontend calls these on the worker
export interface WorkerAPI {
    setup(config: SetupConfig): Promise<void>;  // first-run: create AB + configure Pi
    prompt(text: string): Promise<void>;
    abort(): Promise<void>;
    steer(text: string): Promise<void>;
    setModel(provider: string, modelId: string): Promise<void>;
    setThinkingLevel(level: string): Promise<void>;
    compact(): Promise<void>;
    shutdown(): Promise<void>;  // fork session + spawn reflect child
}

export interface SetupConfig {
    rootDir: string;
    provider: string;         // "anthropic" | "openai" | "google" | "custom"
    model: string;            // e.g. "claude-sonnet-4-20250514"
    apiKey?: string;
    baseUrl?: string;         // for custom OpenAI-compatible
}

// Worker calls these on the frontend
export interface FrontendAPI {
    onAgentEvent(event: AgentEvent): void;
    onDeferredDue(items: DeferredItem[]): void;
    onWorkerError(error: string): void;
}
```

### 4. Frontend — Chat UI (Svelte)

Minimal, clean chat interface. Svelte chosen for: small bundle, reactive by
default, no virtual DOM overhead, good DX for streaming updates.

**Components:**

```
App.svelte
├── SetupWizard.svelte (shown on first run only)
│   ├── WelcomeScreen.svelte
│   ├── LocationPicker.svelte (file picker, default ~/buddy)
│   ├── ProviderSelector.svelte (cards: Anthropic, OpenAI, Google, Custom)
│   ├── ApiKeyInput.svelte (for remote providers)
│   ├── ModelSelector.svelte (list from provider, with recommendations)
│   └── SetupProgress.svelte (creating dirs, git init, configuring...)
├── ChatView.svelte
│   ├── MessageBubble.svelte (user | assistant | system)
│   │   ├── MarkdownRenderer (for assistant messages)
│   │   ├── ThinkingBlock.svelte (collapsible, italic)
│   │   └── ToolCallBlock.svelte (collapsible, shows tool + result)
│   ├── FileViewer.svelte (FR-CHAT-10: inline .md/.txt panel; openPath fallback)
│   ├── StreamingIndicator.svelte (typing dots while streaming)
│   └── CompactionNotice.svelte (brief inline notice)
├── InputBar.svelte
│   ├── TextArea (auto-resize, shift+enter for newlines)
│   ├── SendButton (disabled while streaming)
│   └── AbortButton (visible while streaming)
└── SettingsModal.svelte (accessed via gear icon, Cmd+,, or app menu)
    ├── Provider dropdown (cascading: filters model list)
    ├── Model dropdown (per-provider)
    ├── Language selector
    ├── AB directory path (read-only)
    └── Add provider inline auth (OAuth + API key fallback)
```

**Frontend ↔ Worker connection:**

```typescript
// src/lib/agent.ts — frontend side of kkrpc
import { createChannel } from "tauri-plugin-js-api";
import type { WorkerAPI, FrontendAPI, AgentEvent } from "../shared/api";

const frontendApi: FrontendAPI = {
    onAgentEvent(event: AgentEvent) {
        // Route to Svelte stores
        handleEvent(event);
    },
    onDeferredDue(items) {
        // Trigger OS notification via Tauri
        notify(`${items.length} pending reminders`);
    },
    onWorkerError(error) {
        connectionStore.set("error");
    },
};

export const { api } = await createChannel<FrontendAPI, WorkerAPI>(
    "agent-worker", frontendApi
);

// Now: api.prompt("hello") calls the worker directly
```

**Event routing to Svelte stores:**

```typescript
function handleEvent(event: AgentEvent) {
    switch (event.type) {
        case "agent_start":
            streamingStore.set(true);
            break;
        case "message_start":
            if (event.role === "assistant") messages.addAssistant();
            break;
        case "message_update":
            if (event.assistantMessageEvent?.type === "text_delta")
                messages.appendText(event.assistantMessageEvent.delta);
            if (event.assistantMessageEvent?.type === "thinking_delta")
                messages.appendThinking(event.assistantMessageEvent.delta);
            break;
        case "tool_execution_start":
            messages.addToolCall(event.toolName);
            break;
        case "tool_execution_end":
            messages.setToolResult(event.toolName, event.result);
            break;
        case "message_end":
            messages.finalizeMessage();
            break;
        case "agent_end":
            streamingStore.set(false);
            break;
        case "compaction_end":
            messages.addSystemNotice("Context compacted");
            break;
    }
}
```

**Styling:**

- System-native feel: respect OS dark/light mode (`prefers-color-scheme`)
- Minimal chrome — message bubbles, subtle borders, readable typography
- Fixed input bar at bottom, scrollable message area
- Assistant messages rendered as markdown (code blocks, lists, bold/italic)
- User messages as plain text in distinct bubble style

**Streaming UX:**

- Text appears token-by-token as `message_update` events arrive
- Smooth scroll-to-bottom on new content (with "scroll to bottom" button if user scrolled up)
- Thinking blocks appear in a collapsible section above the response
- Tool calls show as expandable cards between text blocks

**Keyboard shortcuts:**

- `Enter` — send message
- `Shift+Enter` — newline in input
- `Escape` — abort current generation
- `Cmd/Ctrl+,` — settings

### 5. Heartbeat Scheduler (in worker)

Runs inside the Node.js worker — no Rust timers needed. Uses **usage-based
counters**, not wall-clock times: consolidation fires when there's material
to consolidate, not at a calendar slot.

**Responsibilities:**

- Check `deferred.md` at configurable interval (default: 30 minutes)
- Parse dates in deferred items; if any are due, notify frontend → OS notification
- Track usage counters: sessions completed, new content (git diff)
- Evaluate whether consolidation is due on every heartbeat tick + app start
- Trigger consolidation via separate Pi session (depth >= 1)
- Persist live session file path in `.buddy/consolidation-state.json` at session
  create; heartbeat may refresh last-known timestamp for diagnostics
- Prune `.buddy/logs/*.jsonl` older than 7 days on boot and heartbeat
  (`pruneSessionLogs()`, NFR-MAINT-01)

**Counter model:**

```typescript
// backends/scheduler.ts
interface ConsolidationState {
    sessionsSinceLastDepth1: number;
    depth1RunsSinceLastDepth2: number;
    depth2RunsSinceLastDepth3: number;
    lastDepth1: string | null;   // ISO timestamp
    lastDepth2: string | null;
    lastDepth3: string | null;
}

const THRESHOLDS = {
    depth1: { sessions: 3, maxIntervalHours: 24 },  // wall-clock ceiling, never the trigger
    depth2: { depth1Runs: 5, maxIntervalHours: 168 },
    depth3: { depth2Runs: 4, maxIntervalHours: 720 },
};
```

The worker increments `sessionsSinceLastDepth1` when a session ends with
new content (checked via `git diff --stat` since last consolidation commit).
Wall-clock intervals are optional ceilings ("at most once per day"), never
the primary trigger.

**Implementation:**

```typescript
// In agent-worker.ts
import { readFile } from "node:fs/promises";

const HEARTBEAT_INTERVAL = 30 * 60 * 1000; // 30 minutes

setInterval(async () => {
    // Deferred check — lightweight, no LLM
    const content = await readFile(`${AB_DIR}/agent_brain/deferred.md`, "utf-8");
    const due = parseDeferredItems(content).filter(isDue);
    if (due.length) frontendApi.onDeferredDue(due);

    // Session log housekeeping — delete .buddy/logs/*.jsonl older than 7 days (NFR-MAINT-01)
    await pruneSessionLogs(AB_DIR);

    // Consolidation check — evaluate counters
    await evaluateConsolidation();
}, HEARTBEAT_INTERVAL);

async function evaluateConsolidation() {
    const state = await loadConsolidationState(AB_DIR);
    const hasNewContent = await hasContentSinceLastRun(AB_DIR, state);

    if (!hasNewContent) return;

    const depth = determineConsolidationDepth(state, THRESHOLDS);
    if (depth === null) return;

    // Don't interrupt active user streaming
    if (session.isStreaming) return;

    await runConsolidation(depth, state);
}
```

### Consolidation Runner

Depth-parameterized consolidation with automatic cascade: if depth-2 is due
but depth-1 hasn't been done, it runs depth-1 first.

**Runner logic:**

```typescript
// backends/consolidation.ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

async function runConsolidation(targetDepth: number, state: ConsolidationState) {
    // Lock — prevent concurrent consolidations
    const lock = await acquireLock(`${AB_DIR}/.buddy/maintenance.lock`);
    if (!lock) return;

    try {
        // Pre-compute reports for consolidation prompt (worker code, no LLM)
        const hebbianReport = await computeHebbianReport(AB_DIR);
        const brainHealthReport = await computeBrainHealthReport(AB_DIR);
        const upcomingReminders = await findUpcomingReminders(AB_DIR);
        const ripeObservations = extractRipeObservations(AB_DIR);

        // Cascade: run lower depths first if needed
        for (let d = 1; d <= targetDepth; d++) {
            if (isDepthDue(d, state)) {
                await runSingleDepth(d, { hebbianReport, brainHealthReport, upcomingReminders, ripeObservations });
                logRun(d, "success");
                advanceCounters(state, d);
            }
        }
        await saveConsolidationState(AB_DIR, state);
    } catch (e) {
        // Failed runs don't advance counters
        logRun(targetDepth, "fail", e.message);
    } finally {
        await releaseLock(lock);
    }
}

async function runSingleDepth(depth: number) {
    // Separate Pi session — never the user's live session
    const maintenanceLoader = new DefaultResourceLoader({
        cwd: AB_DIR,
        agentDir: `${homedir()}/.pi/agent`,
        systemPromptOverride: () => assembleMaintenancePrompt(AB_DIR, depth),
    });
    await maintenanceLoader.reload();

    const maintenanceResult = await createAgentSession({
        sessionManager: SessionManager.create(AB_DIR),
        modelRuntime,
        resourceLoader: maintenanceLoader,
        excludeTools: ["bash"],
        tools: ["read", "write", "edit", "grep", "find", "ls"],
        cwd: AB_DIR,
    });

    try {
        await maintenanceResult.session.prompt(
            `Run consolidation at depth ${depth}. Follow the consolidation procedure.`
        );
    } finally {
        maintenanceResult.session.dispose();
    }
}
```

**Lock management:** A unified lock file (`maintenance.lock`) prevents
concurrent maintenance operations. Consolidation runs use the lock. The lock
includes a PID and timestamp; stale locks (process dead or lock older than
1 hour) are automatically broken.

**Idle-awareness:** If `session.isStreaming` is true (user is actively
interacting), consolidation operations defer until the next heartbeat tick.
Reflects run in separate processes and do not block the user session.

**Run journal:** Each consolidation run is logged to
`AB_DIR/.buddy/consolidation-log.json`:

**Brain health report** (`backends/brain-health.ts`, FR-BRAIN-07):

```typescript
interface BrainHealthReport {
    missingHeaders: string[];   // files without required frontmatter (excl. SOUL.md/USER.md — always-injected)
    missingIndexes: string[];   // dirs with >1 file and no index.md
    coreMissing: string[];      // SOUL.md, USER.md, AGENTS.md, deferred.md
    oversizedFiles: string[];   // files exceeding line threshold — split candidates
}
```

Computed deterministically before consolidation (same injection pattern as
`computeHebbianReport()`). Index rebuild can use `summary` frontmatter fields
without LLM calls (NFR-FORMAT-01).

```json
[
    { "timestamp": "2026-07-18T23:15:00Z", "depth": 1, "duration_ms": 45200, "status": "success" },
    { "timestamp": "2026-07-19T10:30:00Z", "depth": 2, "duration_ms": 120400, "status": "fail", "error": "API timeout" }
]
```

### 6. System Tray (Rust + Tauri)

The app lives in the system tray for always-on presence. This is one of the
few things that must be in Rust (OS-level integration).

**Tray menu:**

- Open chat window
- Quick capture (small floating input → sends to Pi as brain dump)
- Status: model, last interaction time
- Pause/resume heartbeat
- Quit

**Behavior:**

- Closing the window hides to tray (doesn't quit)
- Tray icon shows notification badge when deferred items are due
- Double-click tray icon opens/focuses chat window
- **Launch at login:** the app registers for launch-at-login (Tauri supports
  this per-platform via `tauri-plugin-autostart`). On start, check overdue
  consolidations and deferred items

### 7. Extension UI Handling

Pi extensions can emit UI events. Since we're using the SDK directly,
we handle them through the session's event stream:

```typescript
session.subscribe((event) => {
    if (event.type === "extension_ui_confirm") {
        // Ask frontend to show confirm dialog
        const answer = await frontendApi.showConfirm(event.title, event.message);
        // Respond back to Pi (extension is waiting)
        event.respond(answer);
    }
});
```

This is cleaner than the RPC approach — no separate `extension_ui_response`
JSON command needed. The SDK handles the callback directly.

## Data Flow — User Sends Message

```
1. User types in InputBar, presses Enter
2. Frontend: disable input, show user bubble
3. Frontend: api.prompt("user message")  ← type-safe RPC call
4. Worker: session.prompt("user message") ← Pi SDK direct call
5. Pi: processes, streams events via session.subscribe()
6. Worker: forwards each event → frontendApi.onAgentEvent(event)
7. Frontend: reactive store updates
   - agent_start → show typing indicator
   - message_start → create assistant bubble
   - message_update (text_delta) → append text
   - message_update (thinking_delta) → append to thinking block
   - tool_execution_start → show tool card
   - tool_execution_end → show result in card
   - message_end → finalize bubble
   - agent_end → hide indicator, re-enable input
8. User can press Abort → api.abort() → session.abort()
```

## Data Flow — Heartbeat Notification

```
1. setInterval fires in worker (every 30 min)
2. Worker: fs.readFile("agent_brain/deferred.md")
3. Worker: parse dates, compare with now
4. If items due:
   a. frontendApi.onDeferredDue(items)
   b. Frontend: invoke Tauri notification plugin → OS notification
   c. Frontend: set tray badge (via Tauri command)
5. User clicks notification → window focus
```

## Data Flow — Scheduled Maintenance

```
1. Heartbeat tick fires (every 30 min) or app starts
2. Worker: load consolidation state, check counters + git diff
3. If no new content or thresholds not met → skip
4. If user is streaming → defer to next tick
5. Worker: acquire consolidation lock
6. Worker: determine target depth, cascade lower depths first
7. Worker: spawn separate Pi maintenance session
8. Maintenance session: runs consolidation at target depth
9. Worker: after depth-1, update logs/index.md from Day summary Key themes
10. Worker: dispose maintenance session, log run, advance counters
11. Worker: release lock, auto-commit results
```

## Data Flow — App Close (fork-only reflect)

```
Session end (normal close):
1. User closes window / quits app
2. Frontend: api.shutdown()
3. Worker: fork session file, spawn background child with metadata args
4. Worker: session.dispose()
5. Frontend: win.destroy() — window closes immediately
6. Background child (async, independent of app):
   - SessionManager.forkFrom(sessionFile, rootDir, forkDir) — full conversation context
   - createAgentSession({ sessionManager: forkedSM }) on the forked JSONL
   - Single user prompt: loads `process-conversation.md` from bundled prompts
     with output-only suffix (FR-SKILL-04) — NO system prompt override,
     NO ResourceLoader, NO AGENTS.md
   - LLM already sees the full conversation in the fork → writes Decisions,
     Lessons, Context, Open threads, Tasks captured, Ideas, System observations
   - Commits agent file writes immediately after LLM call
   - Appends ## Session HH:MM–HH:MM to logs/YYYY-MM-DD.md (metadata from spawn args)
   - Updates logs/index.md entry for the session date, commits, exits

Spawn mechanism:
  dev:  child_process.fork(reflect-child.ts) with tsx
  prod: spawn(process.execPath, ["--reflect", ...]) — same binary, argv dispatch
```

**Crash recovery (boot):** If `.buddy/consolidation-state.json` contains a
session path with no completed reflect, the worker forks and spawns a reflect
child before creating the new live session. Session path is persisted at session
create (not only on heartbeat).

**Checkpoint reflect (mid-session):** On `compaction_start` only — the worker
forks the current session **before** Pi compacts and spawns a background child
process with mode `checkpoint`. Pi's compaction proceeds in parallel (reflect
fork + Pi summary = 2 LLM calls per compaction event). The child opens the fork
and sends a single user prompt (Context + Notes only) — no system prompt, no
resource loader. Uses a fast-tier model. Appends a `## Checkpoint HH:MM` block
to `logs/YYYY-MM-DD.md`. The user's conversation is never interrupted.
Turn-count checkpoints (`INCREMENTAL_REFLECT_EVERY`) are removed — compaction
is the signal that context detail is at risk.

**Pre-consolidation reflect:** When consolidation is due and the live session
has unreflected activity, reflect runs first so the daily log is current, then
the consolidation cascade proceeds.

Session-end reflect produces the comprehensive `## Session HH:MM–HH:MM` entry
covering the final segment since the last checkpoint (if any).

**Mid-session visibility:** Checkpoint and session-end reflects commit to the
daily log immediately. During long sessions the agent can read files created or
updated by reflect output (decisions captured, tasks written) without waiting
for session end.

**Key design principle:** The fork IS the context. The forked session file
contains the full conversation (all user/assistant turns, tool calls, tool
results). The reflect child does not inject external resources — those weren't
part of the session and would dilute the context. The only LLM input beyond
the fork itself is a user prompt requesting the structured output format.

The app window closes in <100ms. All LLM work is in detached background
processes. Agent file writes are committed immediately after the LLM call,
before daily log finalization.

## Permission Model

AB is more dynamic than purpose-built agents (pipelines-debugger, author-kb)
that have fixed scopes. The user can ask AB to read articles, ingest external
files, or interact with arbitrary paths. The permission model
must balance **flexibility** (the user can do anything) with **safety** (a
prompt injection in an ingested document can't exfiltrate data).

This replaces pi-permission-gate (the extension). In the SDK architecture,
permissions are enforced directly in the worker with access to the frontend
for interactive confirmation — strictly superior to silent blocking.

### Trust Zones

Three zones with escalating friction:

```
Zone 1 — AB Home (full access, never ask):
  AB_DIR/**              → read, write, edit, delete
  Exceptions (require user confirmation even inside Zone 1):
    - agent_brain/identity/SOUL.md  → write confirms
    - .pi/settings.json             → write blocked (agent can't reconfigure its own model)

Zone 2 — User-designated (read silent, write confirms):
  Explicitly shared paths (persisted in ~/.buddy/allowed-paths.json)
  e.g. ~/Documents/articles/, ~/git/complex-system-kb/
  → read: allowed silently
  → write: ask user in chat

Zone 3 — Everything else (ask or deny):
  → read: ask user (unless path was mentioned in their message)
  → write: always ask
  
Hardcoded denylist (never accessible, even with confirmation):
  ~/.ssh/*, ~/.gnupg/*, ~/.aws/*, **/auth.json, **/.env
```

The tool set is **file-only** (read, write, edit, ls, find, grep) — no bash,
no shell, no arbitrary code execution. This eliminates the need for command
allowlists and reduces the permission model to pure file-path classification.

**Read-class operations:** `ls`, `find`, and `grep` are classified as reads
in the zone model. Their path/directory arguments go through the same zone
classification as `read`. The `extractPath()` helper normalizes their
argument shape (directory for `ls`/`find`, path for `grep`) into a single
path for zone lookup.

### Implicit permission from user messages

When the user mentions a path in their chat message, read access is implicitly
granted for that session:

```typescript
// "Ingesta el artículo en ~/Documents/draft.md"
// → path ~/Documents/draft.md extracted from message
// → read allowed without confirmation for this session
```

This is the key UX insight: **if the user told you to read it, you don't need
to ask again**. The confirmation flow only triggers when the *agent* discovers
a path on its own (e.g., following a link in a document, or inferring a path).

### Implementation

```typescript
// backends/permissions.ts

interface PermissionConfig {
    abDir: string;
    zone2Paths: string[];              // persisted user-designated paths
    sessionAllowedPaths: Set<string>;  // from user messages, cleared per session
    denylist: string[];                // hardcoded, never override
    identityFiles: string[];           // require confirmation even in Zone 1
    blockedWrites: string[];           // never writable by agent (e.g. .pi/settings.json)
}

export function createPermissionLayer(config: PermissionConfig, frontendApi: FrontendAPI) {
    return async (toolCall: ToolCall): Promise<"allow" | "deny"> => {
        const path = extractPath(toolCall);
        if (!path) return "allow";

        const isWrite = ["write", "edit", "delete"].includes(toolCall.name);  // defensive: delete not in current tool set but guards against future additions

        // Hardcoded denylist — never allow
        if (matchesDenylist(path, config.denylist)) return "deny";

        // Blocked writes — agent can't reconfigure itself
        if (isWrite && matchesAny(path, config.blockedWrites)) return "deny";

        // Zone 1 — AB home
        if (isUnder(path, config.abDir)) {
            // Identity files require confirmation for writes
            if (isWrite && matchesAny(path, config.identityFiles)) {
                return frontendApi.requestPermission({
                    action: toolCall.name, path,
                    options: ["allow_once", "deny"],
                });
            }
            return "allow";
        }

        // Session-allowed (user mentioned this path)
        if (config.sessionAllowedPaths.has(normalizePath(path))) return "allow";

        // Zone 2 — user-designated paths
        if (isUnderAny(path, config.zone2Paths)) {
            if (!isWrite) return "allow";
            // Write in Zone 2 → confirm
        }

        // Zone 3 or Zone 2 write — ask user
        const response = await frontendApi.requestPermission({
            action: toolCall.name,
            path,
            options: ["allow_once", "allow_session", "allow_always", "deny"],
        });

        switch (response) {
            case "allow_once": return "allow";
            case "allow_session":
                config.sessionAllowedPaths.add(normalizePath(path));
                return "allow";
            case "allow_always":
                config.zone2Paths.push(dirname(path));
                persistConfig(config);
                return "allow";
            case "deny": return "deny";
        }
    };
}
```

### Frontend UX for permission requests

Permission requests appear as a special bubble in the chat:

```
┌─────────────────────────────────────────────┐
│  🔒 AB wants to read                        │
│  ~/Documents/articles/draft-emergencia.md   │
│                                             │
│  [Allow once] [Allow folder] [Deny]         │
└─────────────────────────────────────────────┘
```

Non-blocking: the agent pauses on that tool call until the user responds.
Other UI remains interactive (user can scroll history, etc.).

### Integration with worker

The permission layer hooks into `session.agent.beforeToolCall` using the
chained pattern shown in the worker setup section (saves `originalBefore`,
delegates after our check). See the `agent-worker.ts` setup block for the
canonical snippet — a single chained `beforeToolCall` handles both
permission checks and extension hooks.

### FrontendAPI additions

```typescript
export interface FrontendAPI {
    // ... existing methods ...
    requestPermission(request: PermissionRequest): Promise<PermissionResponse>;
}

export interface PermissionRequest {
    action: string;            // "read" | "write" | "edit" | "delete"
    path: string;
    options: PermissionResponse[];
}

export type PermissionResponse = "allow_once" | "allow_session" | "allow_always" | "deny";
```

### Persistence

Zone 2 paths persist in `~/.buddy/allowed-paths.json`:

```json
{
    "allowedPaths": [
        { "path": "/Users/juanje/Documents/articles", "type": "directory" },
        { "path": "/Users/juanje/git/complex-system-kb", "type": "directory" }
    ]
}
```

App configuration lives in `~/.buddy/config.json`:

```json
{
    "rootDir": "/Users/juanje/buddy",
    "provider": "openai",
    "model": "gpt-5.6-luna"
}
```

### MVP vs full implementation

**MVP (Phase 1) — implemented:** Zone 1 always allow (with SOUL.md
confirmation), everything outside asks in chat with three options: "Allow
once", "Allow this file always", "Allow this folder always", or "Deny".
Zone 2 (persistent allows) implemented via `~/.buddy/allowed-paths.json`.
Denylist (hardcoded never-access paths) active. Implicit permission from
user-mentioned paths active (session-scoped). USER.md writes are Zone 1
(silent allow — the agent manages profile freely).

## File Ingest (Drag & Drop / Attach)

Users can share files with the agent by dragging them into the chat window
or using an attach button. This is "read this" — the agent reads and
discusses the file. Structured wiki ingest is NOT v1.

### UX

- **Drop target:** the entire chat window. Visual highlight on drag-over
  (subtle border glow or overlay). Dropped file shows as an attachment chip
  on the pending message in the input bar.
- **Attach button:** alternative entry point in `InputBar`, opens a native
  file picker. Same result as drag & drop.
- **Chip display:** filename + size. Click to remove before sending. Multiple
  files allowed.

### Permission

- A file dropped or attached by the user grants **implicit read permission**
  for that session (extends the existing implicit-from-user-message rule).
  The path is added to `sessionAllowedPaths`.
- **Directories:** implicit read for the tree, but confirm above a size
  threshold (e.g., >50 files) to avoid accidentally flooding context.

### Mechanics

- Tauri v2's `onDragDropEvent` provides native file paths — no Electron-style
  File API workarounds needed. The frontend receives paths directly.
- Frontend forwards paths to the worker via kkrpc.
- Worker adds each path to `sessionAllowedPaths` and includes
  `"User attached: <path>"` in the prompt context so the agent knows to
  read it.

### Scope in v1

- **"Read this"**, not "index this." Dropping a file means the agent reads
  and discusses it in the current session. Structured wiki ingest
  (`wiki-ingest` skill) is a separate flow, not triggered by drag & drop.
- **Formats:** v1 supports markdown, plain text, images (via Pi vision API),
  and PDF (local text extraction via `pdf-parse`). Unsupported formats
  (.docx, etc.) show a message suggesting export to text.

### Phase

Drag & drop UI + permission wiring ships in **Phase 1** (core capture
for the target audience). The feature is lightweight to implement (Tauri
provides the native event, permission layer already supports
`sessionAllowedPaths`) and high-value for day-one use.

## Hebbian Tracking Layer

Code-enforced file access tracking. Uses `session.agent.afterToolCall` to
record successful reads (only when `!ctx.isError`). The chained
`afterToolCall` pattern is shown in the worker setup section.

**Mechanism:** When the agent calls `read` on a file, the worker checks if
the file has YAML frontmatter with `access_count`. If so:

1. Increment `access_count`
2. Update `last_accessed` to today's date
3. Queue the frontmatter update (don't write immediately — see race handling)
4. Pass the file content through to the LLM unchanged

**Frontmatter fields:**

| Field | Updated by | Purpose |
|-------|------------|---------|
| `summary` | Agent at create / consolidation | Progressive disclosure; programmatic indexes (NFR-FORMAT-01) |
| `access_count`, `last_accessed` | Hebbian read hook | Promotion/demotion signal |
| `created` | Agent at create | Provenance |

The Hebbian hook never writes `summary` — only `access_count` and `last_accessed`.

```typescript
// backends/hebbian.ts
const sessionReadSet = new Set<string>();  // cleared on session start

export function createHebbianTracker(abDir: string) {
    return {
        onRead(path: string): void {
            if (!isUnder(path, abDir)) return;
            const normalized = normalizePath(path);

            // Dedup: count each file once per session
            if (sessionReadSet.has(normalized)) return;
            sessionReadSet.add(normalized);

            // Exclusions: structural files loaded at startup
            if (isExcluded(normalized, abDir)) return;

            queueFrontmatterUpdate(normalized, {
                access_count: (current) => current + 1,
                last_accessed: new Date().toISOString().slice(0, 10),
            });
        },

        async flush(): Promise<void> {
            // Write all queued frontmatter updates
            // Called at turn end, AFTER the LLM's own writes have landed
            await flushPendingUpdates();
        },

        resetSession(): void {
            sessionReadSet.clear();
        },
    };
}
```

**Exclusions** (managed by code, not by LLM judgment):
- Files opened for edit-only (write/edit tool calls, not read)
- Structural files exempt from Hebbian scoring: directory indexes,
  SOUL.md and USER.md (loaded at session start, not "consulted"),
  observations.md, deferred.md, core skills
- Same file read multiple times in one session (dedup via `sessionReadSet`)

**Race condition handling:** Frontmatter updates are queued during the turn
and flushed at turn end, after the LLM's own writes have landed. This
prevents the worker and the LLM from writing to the same file
simultaneously. The flush reads the current file content (which may have
been modified by the LLM during the turn), updates only the frontmatter
fields, and writes back.

**Lazy commits:** Hebbian frontmatter updates are committed lazily —
batched with the next content commit or at session end. This keeps git
history meaningful (no per-turn commits for metadata-only changes).

**Integration with worker hooks:**

Hebbian tracking runs via the `tool_execution_end` event in
`session.subscribe()` (sole path — the chained `afterToolCall` Hebbian
path was removed as redundant per Fable review finding F). Permission
checks run in the chained `beforeToolCall`. Flushing queued frontmatter
updates happens on the `agent_end` event:

```typescript
// Hebbian tracking (via subscribe, not afterToolCall)
session.subscribe((event) => {
    if (event.type === "tool_execution_end" && event.toolName === "Read" && !event.isError) {
        hebbianTracker.trackAccess(event.args?.path);
    }
    if (event.type === "agent_end") {
        hebbianTracker.flush();
    }
});
```

## File Structure (Tauri project)

```
ab-app/
├── src-tauri/
│   ├── Cargo.toml               # Minimal: tauri + plugins only
│   ├── tauri.conf.json          # Window config, plugin permissions
│   ├── capabilities/
│   │   └── default.json         # Permissions for plugin-js, notification, etc.
│   └── src/
│       └── main.rs              # Plugin registration + menu + tray setup
├── backends/
│   ├── agent-worker.ts          # Pi SDK session + kkrpc API + scheduler
│   ├── permissions.ts           # Trust zones, file-path permission layer
│   ├── setup.ts                 # Deterministic AB directory setup
│   ├── sync.ts                  # Git sync (multi-device)
│   ├── scheduler.ts             # Simple interval/cron scheduler utility
│   └── deferred-parser.ts       # Parse deferred.md date entries
├── shared/
│   └── api.ts                   # WorkerAPI + FrontendAPI type definitions
├── templates/                   # Bundled AB structure templates
│   ├── AGENTS.md
│   ├── agent_brain/
│   │   ├── identity/SOUL.md
│   │   ├── identity/USER.md     # Placeholder for agent personalization
│   │   └── skills/              # Core skills (daily, weekly, etc.)
│   └── user/
│       └── inbox.md
├── src/                         # Frontend (Svelte)
│   ├── App.svelte
│   ├── lib/
│   │   ├── ChatView.svelte
│   │   ├── MessageBubble.svelte
│   │   ├── InputBar.svelte
│   │   ├── StatusBar.svelte
│   │   ├── ToolCallBlock.svelte
│   │   ├── ThinkingBlock.svelte
│   │   └── SettingsModal.svelte
│   ├── stores/
│   │   ├── messages.ts          # Message list store
│   │   ├── connection.ts        # Worker connection state
│   │   └── settings.ts          # User preferences
│   └── utils/
│       ├── markdown.ts          # Markdown → HTML renderer
│       └── agent.ts             # kkrpc channel setup + event routing
├── package.json                 # All TS deps (svelte, pi, kkrpc, tauri-api)
└── README.md
```

## Technology Choices


| Concern           | Choice                                          | Rationale                                      |
| ----------------- | ----------------------------------------------- | ---------------------------------------------- |
| App framework     | Tauri v2                                        | Native feel, small binary, system webview      |
| Frontend          | Svelte 5                                        | Minimal bundle, reactive, ideal for streaming  |
| Backend logic     | TypeScript (Node.js worker via tauri-plugin-js) | Same language as Pi, direct SDK access         |
| Pi integration    | SDK (`createAgentSession()`)                    | In-process, no protocol overhead, full API     |
| Frontend ↔ Worker | kkrpc (via tauri-plugin-js)                     | Type-safe, bidirectional, handles streaming    |
| Markdown          | marked + highlight.js                           | Lightweight, covers code blocks                |
| Notifications     | tauri-plugin-notification                       | Cross-platform OS notifications                |
| System tray       | Tauri built-in tray                             | Native tray icon + menu                        |
| Global hotkey     | tauri-plugin-global-shortcut                    | Quick capture trigger                          |
| Worker packaging  | Bun compile or Node SEA                         | Standalone binary, no runtime needed for users |


## Dependencies

### Rust (src-tauri/Cargo.toml) — minimal

- `tauri` v2
- `tauri-plugin-js` (Node.js worker management)
- `tauri-plugin-notification`
- `tauri-plugin-global-shortcut`

### TypeScript (package.json) — where all logic lives

- `@earendil-works/pi-coding-agent` (Pi SDK)
- `@tauri-apps/api` v2
- `@tauri-apps/plugin-notification`
- `tauri-plugin-js-api` (kkrpc frontend adapter)
- `kkrpc` (type-safe RPC)
- `simple-git` (git operations — wraps system binary with typed API)
- `svelte` v5
- `marked` (markdown rendering)
- `highlight.js` (code syntax highlighting)

## First-Run / Onboarding

The app must be usable from zero — no pre-existing AB directory, no Pi config,
no terminal knowledge. The onboarding splits into two clear phases:
**deterministic setup** (code, no LLM) and **personalization** (the agent itself).

### Prerequisites check

On launch, the app verifies system requirements:

| Requirement | Check | If missing |
|-------------|-------|------------|
| Git | `which git` / registry check | Show message + link to install instructions per platform |
| Node.js (dev only) | `which node` | Show message (not needed if worker is compiled binary) |

No auto-installation — just clear guidance. These are hard prerequisites that
the user must resolve before the app can proceed.

### Phase A — Deterministic setup (code, no LLM)

Runs entirely in the worker (TypeScript). No model needed yet.

```typescript
// backends/setup.ts
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import simpleGit from "simple-git";

async function setupAB(abDir: string, llmConfig: LLMConfig) {
    // 1. Create directory structure
    await mkdir(`${abDir}/agent_brain/identity`, { recursive: true });
    await mkdir(`${abDir}/agent_brain/projects`, { recursive: true });
    await mkdir(`${abDir}/agent_brain/concepts`, { recursive: true });
    await mkdir(`${abDir}/agent_brain/skills`, { recursive: true });
    await mkdir(`${abDir}/agent_brain/ideas`, { recursive: true });
    await mkdir(`${abDir}/user`, { recursive: true });
    await mkdir(`${abDir}/logs`, { recursive: true });

    // 2. Copy base templates (bundled with the app)
    await copyTemplate("AGENTS.md", abDir);
    await copyTemplate("agent_brain/identity/SOUL.md", abDir);
    await copyTemplate("agent_brain/identity/USER.md", abDir);  // placeholder
    await copyTemplate("agent_brain/skills/...", abDir);         // core skills

    // 3. Write Pi settings (from wizard choices)
    await mkdir(`${abDir}/.pi`, { recursive: true });
    await writeFile(`${abDir}/.pi/settings.json`, JSON.stringify({
        defaultProvider: llmConfig.provider,
        defaultModel: llmConfig.model,
    }, null, 2));

    // 4. Write API key (if remote provider)
    if (llmConfig.apiKey) {
        const authPath = `${homedir()}/.buddy/auth.json`;
        await writeFile(authPath, JSON.stringify({
            [llmConfig.provider]: { apiKey: llmConfig.apiKey }
        }, null, 2));
    }

    // 5. Git init + initial commit
    const git = simpleGit(abDir);
    await git.init();
    await git.add("-A");
    await git.commit("Initial AB setup");
}
```

### Phase B — LLM configuration wizard (frontend)

Before Phase A runs, the frontend shows a minimal wizard (Svelte screens):

**Screen 1 — Welcome:**
"Bienvenido a Buddy. Vamos a configurar tu asistente personal."

**Screen 2 — AB location:**
- File picker / path input
- Default: `~/buddy`
- Validation: directory doesn't exist or is empty

**Screen 3 — LLM provider:**
- Cards to choose:
  - **Anthropic** (Claude) — pedir API key
  - **OpenAI** (GPT) — pedir API key
  - **Google** (Gemini) — pedir API key
  - **Other (OpenAI-compatible)** — advanced option: base URL + key
- Show key input field, validate with a test call

**Screen 4 — Model selection:**
- List available models for the chosen provider
- Recommend a default (e.g., Claude Sonnet for Anthropic, GPT-4o for OpenAI)
- Brief description: capability vs cost for each tier

**After wizard:** run Phase A (deterministic setup), then launch the session.

### Phase C — Agent-driven personalization (first conversation)

Once the session starts, the **agent itself** handles personalization. The
base `SOUL.md` template includes instructions for the first interaction:

```markdown
<!-- In SOUL.md template -->
## First session behavior

If USER.md contains only placeholder content, this is a new user.
Introduce yourself briefly and ask:
- What name they go by
- What language they prefer for chat
- What they mainly do (work, interests)
- Any preferences for how you should behave

Write their answers to USER.md. Be conversational, not interrogative —
spread questions naturally across the first few exchanges.
```

This is elegant: the onboarding IS the product. The user's first experience
of AB is already AB working — listening, capturing, organizing. No separate
"setup mode" that feels different from normal use.

### Data Flow — First Run

```
1. App launches, no AB_DIR found
2. Frontend: show wizard screens (location, provider, model)
3. User completes wizard → frontendApi.setup(config)
4. Worker: run deterministic setup (dirs, templates, git init, Pi config)
5. Worker: create Pi session with new config
6. Worker: session.prompt("This is a new user. Begin first-session personalization.", { source: "internal" })
   // source: "internal" flag lets the frontend filter this from display
7. Agent: greets user, starts conversational onboarding
8. Frontend: shows chat — user is already interacting with their AB
9. Agent: writes USER.md as it learns about the user
```

### Configuration persistence

All configuration lives in standard Pi locations:

| What | Where | Managed by |
|------|-------|-----------|
| Provider + model | `AB_DIR/.pi/settings.json` | Wizard → later Settings UI |
| API keys | `~/.buddy/auth.json` | Wizard → later Settings UI |
| AB directory path | `~/.buddy/config.json` | App (Tauri) |
| Scheduler settings | `~/.buddy/scheduler.json` | App (future Phase 3) |

No custom config format — Pi's native settings are the source of truth.
The future Settings UI (Phase 2+) just edits these same files.

**Account login (implemented):** OAuth is the primary authentication path
via `ModelRuntime.login()`. The wizard and settings modal both support
OAuth (browser-based) as primary and API key as fallback. Credentials
are stored in `~/.buddy/auth.json` (NFR-SEC-07).

**API key security:** Keys are written to `~/.buddy/auth.json` (isolated
from Pi CLI's `~/.pi/agent/auth.json` per NFR-SEC-07). The file is created
with mode 600 (owner read/write only). Future improvement: evaluate OS
keychain integration (macOS Keychain, libsecret on Linux) to avoid plaintext
storage.

## Phase 0 — Architecture PoC

Validates that the Tauri + Pi SDK architecture works end-to-end:

1. **Streaming chat** via session.subscribe() in Node.js worker
2. **Chat window** with message bubbles (user + assistant)
3. **Input bar** with send + abort
4. **Basic error handling** (worker crash → show error, offer restart)
5. **Dark/light mode** following system

Phase 0 proves the technical stack. It is NOT shippable — no memory,
no personalization, no persistence.

## MVP Scope (Phase 1)

The true MVP validates "it remembers" — the core promise of AB. Includes
everything in Phase 0 plus the features needed for day-one value:

1. **First-run wizard** (location, provider, API key, model — no Ollama)
2. **Deterministic AB setup** (dirs, templates, git init, Pi config)
3. **Agent-driven personalization** (first conversation writes USER.md)
4. **Forked reflect on close** (background child with full session context)
5. **Fresh session every launch** (continuity via file memory, not session resume)
6. **Deferred surfacing** (check deferred.md on start, surface due items)
7. **System prompt assembly** (AGENTS.md + SOUL.md + USER.md + context)
8. **Permission layer** (Zone 1 always allow with identity confirmation,
   everything else asks)

**Explicitly NOT in Phase 1:**

- System tray (window close = quit)
- Heartbeat/scheduler (consolidation, periodic deferred checks)
- Extension UI proxy (notifications only, no confirm/select)
- Settings UI (configure via Pi's own settings.json)
- Model switching from UI (use Pi's default)
- Worker compiled as binary (use system Node.js for dev)

### Traceability: principles → spec phases

| Value (from design principles) | Phase | How |
|---|---|---|
| **Day-one: conversational capture** | 1 | Chat + Pi SDK with system prompt |
| **Day-one: continuity** | 1 | Fresh session + forked reflect (background) + file memory |
| **Day-one: simple retrieval** | 1 | Agent reads files via AGENTS.md rules |
| **Day-one: task awareness** | 1 | Deferred surfacing on start |
| **Day-one: personalization** | 1 | First-run wizard + agent writes USER.md |
| **Week-one: consolidation** | 2 | Heartbeat scheduler + consolidation runner |
| **Week-one: pattern recognition** | 2 | Hebbian tracking + observation pipeline |
| **Week-one: proactive surfacing** | 2 | Heartbeat deferred checks + notifications |
| **Month-one: adapted behavior** | 3 | Hebbian promotions in weekly consolidation |
| **Month-one: knowledge base** | 3 | Accumulated concepts via monthly cycle |
| **Month-one: trusted memory** | 3 | Full lifecycle proven over time |

## Phase Progression


| Phase             | Adds                                                               | Validates                                              |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| 0 — Architecture  | Streaming chat + Pi SDK in worker                                  | "Does the Tauri + Pi SDK stack work?"                  |
| 1 — MVP           | Forked reflect, fresh sessions, deferred, wizard, permissions     | "Does it remember? Is day-one useful?"                 |
| 2 — Memory        | Hebbian tracking, heartbeat, consolidation runner, notifications   | "Does automated learning change the experience?"       |
| 3 — Polish        | Tool cards, thinking blocks, markdown, model selector, settings UI | "Does richer rendering improve the experience?"        |
| 4 — Daemon        | System tray, launch at login, quick capture hotkey                 | "Does always-on + proactive reminders change usage?"   |
| 5 — Multi-session | Session list, resume, fork (Pi SDK supports natively)              | "Do users want session history?"                       |
| 6 — Distribution  | Compile worker to standalone binary (Bun/SEA), bundle as sidecar   | "Can non-developers install and use this?"             |


## Platform Notes

### macOS (primary)

- WKWebView (Safari engine) — ships with the OS
- Code signing required for distribution (Apple Developer account)
- `.dmg` or `.app` bundle
- Notarization needed for Gatekeeper
- Git available via Xcode Command Line Tools (most macs have it)

### Linux

- WebKitGTK required (usually pre-installed on GNOME/GTK distros)
- `.AppImage` (universal, no install) or `.deb`/`.rpm`
- No signing requirement for direct distribution

### Windows (not targeted for v1)

Windows support is architecturally possible (Tauri supports it) but not
tested or distributed in v1. The first users are on macOS and Linux.
Revisit when distribution (Phase 6) is reached.

## Worker Packaging for Distribution

For development: the worker runs on system-installed Node.js (or Bun).

For distribution (Phase 6): compile the worker into a standalone binary:

**Option A — Bun compile:**

```bash
bun build backends/agent-worker.ts --compile --outfile agent-worker
```

Produces a single executable. Bun's compile bundles the runtime + all deps.

**Option B — Node.js SEA (Single Executable Application):**

```bash
# Bundle with esbuild, then inject into Node binary
esbuild backends/agent-worker.ts --bundle --platform=node --outfile=worker.js
# Create SEA blob and inject into node copy
```

Both preserve stdin/stdout behavior, so kkrpc works unchanged. The compiled
binary ships inside the Tauri app bundle via `externalBin` in `tauri.conf.json`.

### Distribution Considerations — Git Dependency

When Phase 6 (distribution) arrives, non-developer users may not have git
installed. Three options to evaluate:

1. **Bundle portable git binary** — keeps `simple-git` + SSH working as-is.
   Largest binary size increase but simplest integration.
2. **HTTPS-only sync with token auth** — `isomorphic-git` is viable but
   worse UX (no SSH, token management). Avoids external binary dependency.
3. **App-generated SSH key with guided upload to git host** — most invisible
   to the user, most implementation work. App generates key pair, walks
   user through adding public key to GitHub/GitLab.

Decision deferred to Phase 6 scoping.

## Open Design Decisions

1. **Worker runtime for MVP:** Use system Node.js (simplest) or Bun (faster startup, native compile)? Bun has better DX for this use case but is less universal.
2. **Markdown library:** `marked` is lightweight but basic. Alternative: `markdown-it` (more extensions). For code blocks: `highlight.js` vs `shiki` (better but heavier).
3. **Quick capture UX (Phase 6):** Global hotkey → floating window, or system tray → input field? Global hotkey is faster but has cross-platform quirks on Linux.
4. **Session persistence across restarts:** **Decided (E5):** Fresh session every launch. Continuity comes from file memory (logs, identity files), not Pi session resume. `SessionManager.continueRecent()` reserved for future multi-session UI (Phase 5).
5. **Multiple AB directories:** Support switching between instances (my-ab, wab) or one instance per app? Could use a workspace switcher in settings.
6. **Extension UI in chat vs native dialogs:** Render confirm/select/input as chat bubbles with buttons (more cohesive) or as native OS dialogs (more noticeable)?

## Git Sync (multi-device)

Multi-device sync is a planned direction — not if, but when. For users who
keep their AB in a remote repository (GitHub, GitLab, etc.), the app will
support a "connected mode" that syncs automatically.

### Concept

AB is already a git repo. Multi-device sync is just `git pull` + `git push`
at the right moments. No custom sync protocol needed — git handles conflicts,
history, and merging.

### Configuration

Enabled in the first-run wizard (optional step) or later in Settings:

```typescript
interface SyncConfig {
    enabled: boolean;
    remote: string;           // "origin" (default) or custom remote name
    branch: string;           // "main" (default)
    pullOnStart: boolean;     // pull when app launches (default: true)
    pushAfterCommit: boolean; // push after each agent commit (default: true)
    pullInterval?: number;    // periodic pull in minutes (optional, via heartbeat)
}
```

Stored in `~/.buddy/config.json` (app-level, not inside the AB repo).

### Sync behavior

**On app start:**
```
1. git fetch origin
2. git pull --rebase origin main
3. If conflict: notify user, open chat with context
4. If clean: proceed to session
```

**After agent commits** (auto-push):
```
1. Agent writes files + commits (normal AB behavior)
2. Worker detects new commit (fs.watch on .git/refs/heads or post-commit)
3. git push origin main
4. If push fails (remote ahead): pull --rebase, retry push
5. If conflict: notify user
```

**Heartbeat periodic pull** (optional, for catching changes from other devices):
```
1. Every N minutes (configurable, default: 15)
2. git fetch origin
3. If remote has new commits: git pull --rebase
4. If conflict: pause sync, notify user
```

### Conflict handling

Most AB files are single-owner (one device writes at a time), so conflicts
should be rare. However, **append-only files** are conflict magnets:
`logs/index.md`, `agent_brain/observations.md`, `agent_brain/deferred.md`.
Multiple sessions on different devices append to the same file.

**Mitigation — daily-append log model:** All sessions on a given day
append `## Session HH:MM–HH:MM` blocks to a single daily file
(`logs/YYYY-MM-DD.md`). `logs/index.md` is a derived file, rebuilt from
daily log frontmatter after each reflect (in code, no LLM, near-zero
cost). Multi-device conflicts on the same daily file are less likely than
they appear — sessions rarely overlap across devices. When they do, git's
line-level merge usually succeeds (different `## Session` blocks appended
at different positions). Conflicts in `logs/index.md` are resolved by
regeneration — it's derived state, not authored content.

**Before multi-device ships:** `observations.md` and `deferred.md` need
conflict mitigation — either a `merge=union` driver via `.gitattributes`
or stable per-item IDs for deterministic regeneration. Decision deferred
to multi-device implementation.

**Commit batching:** Auto-commits are debounced to one per agent turn, not
per write. The worker collects all file changes during a turn and commits
them together. This reduces noise in git history and minimizes the window
for push conflicts.

When conflicts do happen:

- **Notification:** "Sync conflict in 2 files. Open AB to resolve?"
- **In chat:** Show conflicted files, let the agent help resolve
  (it understands the file formats)
- **Fallback:** `git mergetool` or manual resolution instructions

### Implementation (in worker)

```typescript
// backends/sync.ts
import simpleGit from "simple-git";

export class GitSync {
    private git;

    constructor(private abDir: string, private config: SyncConfig) {
        this.git = simpleGit(abDir);
    }

    async pull(): Promise<SyncResult> {
        try {
            await this.git.fetch(this.config.remote);
            await this.git.pull(this.config.remote, this.config.branch, { "--rebase": null });
            return { status: "ok" };
        } catch (e) {
            if (e.message.includes("CONFLICT")) {
                const status = await this.git.status();
                return { status: "conflict", files: status.conflicted };
            }
            return { status: "error", message: e.message };
        }
    }

    async push(): Promise<SyncResult> {
        try {
            await this.git.push(this.config.remote, this.config.branch);
            return { status: "ok" };
        } catch (e) {
            if (e.message.includes("non-fast-forward") || e.message.includes("fetch first")) {
                await this.pull();
                return this.push();
            }
            return { status: "error", message: e.message };
        }
    }
}
```

Integrated with the heartbeat scheduler:

```typescript
// In agent-worker.ts
if (syncConfig.enabled) {
    // Pull on start
    await sync.pull();

    // Push after commits
    watchForCommits(abDir, () => sync.push());

    // Periodic pull (if configured)
    if (syncConfig.pullInterval) {
        schedule("git-sync", { every: `${syncConfig.pullInterval}m` }, () => sync.pull());
    }
}
```

### Phase placement

Git sync is a **planned Phase 3+** feature (alongside heartbeat/daemon).
Not in MVP because:
- MVP validates the chat experience itself
- Sync requires the heartbeat infrastructure
- Single-device use is sufficient for initial validation

Multi-device is a planned direction, not a nice-to-have. The architecture
is designed with it in mind from day one (per-session log files, derived
indexes, conflict-aware file patterns).

### Wizard integration (future)

An optional step in the first-run wizard or Settings:

- "Do you want to sync with a remote repository?"
- If yes: input remote URL, test connection (`git ls-remote`)
- If existing repo: clone instead of init (skip template copy)
- If new repo: init + set remote + first push

### WorkerAPI additions

```typescript
export interface WorkerAPI {
    // ... existing methods ...
    syncPull(): Promise<SyncResult>;
    syncPush(): Promise<SyncResult>;
    setSyncConfig(config: SyncConfig): Promise<void>;
}

export interface SyncResult {
    status: "ok" | "conflict" | "error";
    files?: string[];
    message?: string;
}
```

### Notes

- Uses rebase (not merge) to keep history linear — simpler for AB's append-only patterns
- SSH keys or credential helpers configured by the user (standard git setup)
- The app never stores git credentials — delegates to git's credential system
- For work instances behind corporate auth (GitLab + SSO), user configures git normally; app just runs `git push/pull`

## Comparison with Previous Architecture (RPC)

The SDK architecture eliminates:

- **All Rust business logic** (JSONL parser, scheduler, state machine)
- **The protocol translation layer** (Pi events → Rust structs → frontend events)
- **Subprocess management complexity** (Pi as child process with stdin/stdout piping)

What remains in Rust: ~30 lines of plugin registration + tray config.

Trade-off: the Node.js worker is a heavier process than a pure Rust backend
would be (~50-80 MB RAM for the Node.js runtime). For a desktop app that's
always running, this is acceptable — comparable to any Electron app but with
Tauri's smaller disk footprint.

## Pi SDK API Verification (v0.80.10, 2026-07-18)

All critical APIs verified against Pi source code. Summary:

| API | Status | Notes |
|-----|--------|-------|
| `createAgentSession()` | Confirmed | Options: `sessionManager`, `modelRuntime`, `resourceLoader`, `excludeTools`, `cwd` |
| `SessionManager.create(cwd, sessionDir?)` | Confirmed | First param is cwd, not session path |
| `SessionManager.continueRecent(cwd)` | Confirmed | Resumes most recent session — reserved for Phase 5 multi-session |
| `SessionManager.open(path)` | Confirmed | Opens specific session file |
| `SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?)` | Confirmed | Copies full history to a new JSONL — used by reflect child without touching live session |
| `session.subscribe(listener)` | Confirmed | Events: `agent_start/end`, `message_start/update/end`, `tool_execution_start/end`, `compaction_start/end` |
| `session.agent.beforeToolCall` | Confirmed | Public property; chain with existing extension hooks |
| `session.agent.afterToolCall` | Confirmed | Includes `isError` — used for Hebbian success tracking |
| `session.agent.prepareNextTurn` | Confirmed | Exists in SDK but not used by the app; `agent_end` event via `subscribe()` is the correct hook for post-turn work |
| `session.prompt/steer/abort/compact` | All confirmed | `prompt` has `PromptOptions`; `steer` is text+images |
| `session.setModel/setThinkingLevel` | Both confirmed | `setModel` async; `setThinkingLevel` sync |
| `excludeTools: ["bash"]` | Confirmed | Clean way to disable bash at session creation |
| `tools: ["read", ...]` | Confirmed | Explicit active tool list (SDK default is only read/bash/edit/write; grep/find/ls must be explicitly activated) |
| System prompt | Via `DefaultResourceLoader({ systemPromptOverride: () => prompt })` | Not a direct `createAgentSession` param |
| Cost/usage data | On `AssistantMessage.usage` in `message_end` events | Full token + cost breakdown |
| Extensions in SDK mode | Fully operational | Extensions load and run normally |

**Key patterns for the app:**
- System prompt: `DefaultResourceLoader({ systemPromptOverride: () => assembled })` → `createAgentSession({ resourceLoader })`
- Bash disabled: `createAgentSession({ excludeTools: ["bash"] })`
- Fresh session: `SessionManager.create(cwd)` every launch (E5 decision)
- Forked reflect: `SessionManager.forkFrom(sessionFile, rootDir, forkDir)` in background child → separate JSONL, no live session pollution. The reflect child does NOT use a ResourceLoader — the fork carries all context; the only input is the bundled `process-conversation.md` prompt with an output-only suffix (FR-SKILL-04).
- Hook chaining: save `session.agent.beforeToolCall`, install ours, delegate to original
- Hebbian tracking: `tool_execution_end` via `session.subscribe()` — tracks file accesses
- Event names: `compaction_start/end` (not `session_compact`); no `model_select` in subscribe events