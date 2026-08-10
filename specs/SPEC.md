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
| FR-CHAT-11 | Local links are view-only, internal, and scoped | 2 ✓ |
| FR-CHAT-12 | Navigation inside the inline viewer | 2 ✓ |
| FR-CHAT-13 | Prompts sent during session boot are queued, not dropped | 2 ✓ |
| FR-CHAT-14 | An assistant turn with no visible text renders nothing | 2 ✓ |
| FR-CHAT-15 | The inline viewer does not render frontmatter as content | 3 ✓ |
| FR-CHAT-16 | Buddy paths in assistant text become labelled links | 3 ✓ |
| FR-CHAT-17 | `show_file` — the agent opens a file in the viewer | 3 ✓ |
| FR-CHAT-18 | Export the viewed file as PDF via the system print dialog | 3 |
| FR-CHAT-19 | Tokenizer artifact stripping in assistant output | 2 ✓ |

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

**FR-CHAT-13 — Prompts sent during session boot are queued**

- **Given** the chat window is open and the Pi session is still booting
- **When** the user sends a message
- **Then** it is held and delivered, in order, as soon as the session accepts
  prompts — never discarded
- **And** if boot exceeds `SESSION_PREPARING_NOTICE_MS`, the UI says the session
  is being prepared; below that threshold it says nothing

**The defect.** `prompt()` in the worker read `await core?.api.prompt(...)`, and
`core` does not exist until `bootSession` resolves. Optional chaining made the
loss silent: the expression evaluates to undefined, the await resolves, and the
call reports success having done nothing. The frontend rendered the user's
bubble and waited for a reply nobody had asked for. No error, no log entry.

**Why it stayed hidden.** Session boot performs a full LLM call before the core
is created — the silent context injection, ~17.7k tokens, whose response is
discarded by design because its purpose is to seed conversation history. On a
commercial provider that window is 1–3 seconds. Measured against a local model
it was **81 seconds**, and a message typed into a fully interactive UI was
dropped without trace.

**Queueing does not shorten the wait, and is not meant to.** The user's first
message cannot precede the injection without giving up the guarantee that the
first answer is informed by the session context. What the queue removes is the
*loss*; the notice addresses the *wait*.

**Why the notice is conditional.** A banner that flashes for two seconds on
every start is noise that teaches users to ignore banners. One that appears only
when something is genuinely slow carries information. It is reassurance, not a
gate: input stays enabled throughout, because anything typed is now safe.

**FR-CHAT-14 — An assistant turn with no visible text renders nothing**

- **Given** an assistant message whose text is empty or whitespace
- **Then** no bubble is rendered — not an empty one

**Observed 2026-07-29.** The guard sat *inside* the bubble element, so an empty
turn still produced a styled, padded box. Local models emit these routinely:
reasoning-only turns arrive as assistant messages whose content is a bare
newline. They accumulated between the thinking indicators and remained on
screen after those cleared, leaving a column of empty grey boxes.

Not local-specific in principle — any provider that emits a turn with no text
produces one — but frequent enough with local models to be the thing that
surfaced it.

**FR-CHAT-15 — The inline viewer does not render frontmatter as content**

- **Given** a markdown file whose first line is `---` opening a YAML frontmatter block
- **When** it is opened in the inline viewer (FR-CHAT-10)
- **Then** the rendered body starts at the content, with no frontmatter in it
- **And** the `summary` field, when present, is shown in the viewer header
  beneath the file name
- **And** the remaining fields (`last_accessed`, `access_count`, `created`) are
  not shown — they are Hebbian bookkeeping, written by the worker and meaningful
  to consolidation, not to the user
- **But when** the file has no frontmatter
- **Then** it renders exactly as before, and the header shows name and path only
- **And** the file on disk is never modified — this is presentation only

**Why it is not cosmetic.** `renderMarkdown` receives the raw text, and in
markdown a `---` line under text is a setext heading. Frontmatter therefore
renders as a horizontal rule followed by an H2 built from the metadata: opening
any brain file makes `summary: … last_accessed: …` the largest thing on the
page, above the content it describes.

**FR-CHAT-16 — Buddy paths in assistant text become labelled links**

- **Given** an assistant message containing a path inside the buddy directory
  that resolves to a viewable file (FR-CHAT-11)
- **When** the message is rendered
- **Then** the path is rendered as a local link (FR-CHAT-09), opening the
  inline viewer on click
- **And** the visible text depends on whose space the file is in:
  - under `agent_brain/` or `logs/` — the file name alone
  - under `user/` or `downloads/` — the full relative path
- **And** the full path remains available in every case: in the link's `title`,
  and in the viewer header once opened
- **And when** a code span holds nothing but such a path — `` `user/inbox.md` ``
- **Then** it becomes a link too: wrapping a file name in backticks is how a
  model writes a path in prose, so that *is* the reference, not a quotation
- **But when** the path is inside a fenced or indented code block, or inside a
  code span holding anything else besides the path
- **Then** it is left exactly as written — there it is content being shown
- **And when** the path is already inside a markdown link — as the href **or**
  as the link's visible text
- **Then** it is left alone, so no link is ever produced inside another
- **And when** the path does not resolve to a viewable file, or falls outside
  the four user-facing directories
- **Then** it is left as plain text, never linked

**Given** the agent wrote the link itself, and its label is nothing but the
target path — bare or inside a code span, which is the form Buddy actually
emits
- **Then** the label is replaced by the same zone-dependent one an autolinked
  path would get
- **But when** the label says anything else (`[mi perfil](…)`)
- **Then** it is left alone: the agent chose a description, and that is better
  than any rule here

**Why this half exists.** Observed in dev: asked for the paths of three files,
Buddy answered with `` [`agent_brain/identity/USER.md`](agent_brain/…) `` — a
markdown link whose label is a code span of the path. Autolinking never sees it,
because the path is already inside a link, so the full internal path reached the
user with the backticks still around it. A rule that only governs the paths
*Buddy did not link* leaves the most polished-looking case as the worst-looking
one.

**Why the label follows the directory rather than a lookup table.** The four
user-facing directories already split in two, and the app makes that split
everywhere: `agent_brain/` and `logs/` are Buddy's memory, `user/` and
`downloads/` are the user's own space ("never auto-archive or prune files in
`user/` — the user controls that space"). For Buddy's own files the location is
Buddy's business and the path is noise mid-sentence. For the user's files the
path *is* the useful part — it is what lets them open the file in Obsidian or a
file manager. The rule is derived from a distinction that already exists, so
there is nothing to keep in sync.

A curated map of file → human label ("your profile" for `USER.md`) was
considered and rejected: it is a hand-maintained list that needs translating per
locale, goes stale silently, and reintroduces inconsistency for everything it
omits — while the files that would benefit most, `USER.md` and `SOUL.md`, read
well enough as names.

**Why a code span counts, established by testing in dev (2026-07-31).** It is
tempting to read backticks as "content, not reference" and exempt them. Buddy's
actual habit is the opposite: asked where a file lives, it answers with ``
`agent_brain/identity/USER.md` `` — for a path in prose, backticks *are* how a
model writes the reference. Exempting them leaves the most common case in the
product unlinked. What distinguishes a quotation is the rest of the span: `cat
user/inbox.md` is a command, and a fenced block is a listing.

**Nested links are a defect this must not produce.** `src/lib/markdown.ts`
renders through marked's token hooks, so this belongs at the token level. A
regex over the rendered HTML would match the href inside an anchor the agent
wrote deliberately and emit `<a>` inside `<a>`. The link *text* is the subtler
case: in `[agent_brain/foo.md](agent_brain/foo.md)` the visible label is a text
token nested in a link token, and an inline extension would re-tokenize it
unless descendants of a link are excluded.

**Why the label matters, and why this is not only a convenience.** Buddy
routinely names the file it touched — *"Cambié tu perfil
`agent_brain/identity/USER.md`"*. Linking that string while still displaying it
leaves the internal layout on screen; it only becomes clickable. The target user
has never opened a terminal and did not ask to learn the directory structure.
Showing `USER.md` and keeping the path behind the link removes the noise without
hiding anything: the viewer header states the full path.

**This is the code half of a two-part design.** The other half is prompt-side:
`agents-base.md` tells Buddy the viewer exists, so it refers to files at all.
That line lives in `~/.buddy/prompts/`, which is app-managed and redeployed on
any version change (NFR-MIGRATE-06), so it reaches installs already in use —
unlike `SOUL.md`, which sits in the rootDir the app never modifies.
Neither substitutes for the other. A renderer can only link a path that appears
in the text — an agent saying *"lo guardé en tu inbox"* offers nothing to link —
and a prompt cannot guarantee the link, because forgetting requires no
disobedience. The prompt makes it likely; the renderer makes it certain once a
path appears.

**FR-CHAT-17 — `show_file` — the agent opens a file in the viewer**

- **Given** the user asks to be shown a file or the content of something Buddy
  keeps ("show me my profile", "let me see my inbox")
- **When** the agent calls `show_file` with a path inside the buddy directory
- **Then** the inline viewer opens on that file, with no click required
- **And** the path is validated exactly as a clicked link is (FR-CHAT-11,
  NFR-SEC-09): viewable extension, inside the four user-facing directories,
  symlinks resolved by the worker
- **And** the tool declares its path argument, so the permission gate covers it
  (NFR-SEC-13)
- **But when** the path is refused
- **Then** the tool returns a plain-language error the agent can relay, and no
  panel opens

**Why this is in the MVP rather than deferred.** For a user coming from a chat
assistant, "show me the file" means *see the content*, not *receive a link to
click*. Reading a link as an offer to view is expert knowledge about how
Buddy works. The capability is discoverable through FR-DOCS-01/02: Buddy is
asked what it can do during first use, so `~/.buddy/docs/capabilities.md` is
where the user learns this exists. Waiting for users to request a feature nobody
advertises measures the silence, not the demand.

**Cost, and why it is low.** `FrontendAPI` is already a worker→frontend push
channel with seven callbacks (permissions, deferred items, budget alerts); this
adds one. Containment is already built and already enforced for clicked links —
the tool surfaces a file the agent could already read, to the user who owns it.

**FR-CHAT-18 — Export the viewed file as PDF via the system print dialog**

**Blocked on a spike.** Whether `window.print()` works in the Tauri webview is
unverified, and it decides the whole shape of this. The spike is a button
calling `window.print()`, built and tried on macOS (WKWebView) and Linux
(WebKitGTK). WKWebView has historically not implemented it, so a negative result
is plausible and must be measured, not assumed. If it fails, the fallback is a
per-platform Rust command (`createPDF()` on macOS, WebKitGTK's print operation
on Linux) — several days rather than an afternoon, and platform-specific code at
a moment when Windows support is already in question. Do not design further
until the spike answers.

- **Given** a file open in the inline viewer (FR-CHAT-10)
- **When** the user activates the export action
- **Then** the system print dialog opens, from which the OS offers "Save as PDF"
- **And** what is printed is the rendered document only — not the app chrome,
  the backdrop, the chat behind it, or the viewer's own buttons
- **And** the user chooses the destination through the native dialog; Buddy
  never writes the PDF to a location it picked
- **And** the file on disk is untouched — the export is a rendering, not a
  conversion

**Why the print dialog rather than a PDF library.** It reuses the exact HTML the
viewer already renders, so the PDF matches what the user is looking at, keeps
selectable text, and adds no dependency. A client-side library would either
rasterize the DOM — unselectable text, poor print quality — or re-implement
markdown layout and drift from the viewer. It is also the clearer concept: the
user is printing or exporting *a version of* content that stays where it was.
Nothing leaves their space; a copy is made.

**Why it does not contradict FR-CHAT-11.** That requirement withdrew handing a
file to an external program, because a link the *agent* wrote must never
invoke the system opener. This is the user acting on the document they are
already looking at, through a native dialog they drive. Stated explicitly so a
later reader does not read it as an oversight.

**Why it is worth building.** Markdown is right for editing and wrong for
sending. A report or article Buddy helped write is trapped for any recipient
without a markdown renderer — and "send it to someone" is the ordinary next step
for the target user, who is not going to install one. FR-CHAT-15 compounds with
it: with frontmatter no longer rendered, the exported PDF carries no bookkeeping
metadata without any extra work.

**FR-CHAT-19 — Tokenizer artifact stripping**

- **Given** the assistant produces a text delta during streaming
- **When** the delta or accumulated text starts with a bare tokenizer
  artifact (`thought`, `thought\n`)
- **Then** the artifact is stripped before the text reaches the user
- **And** only the exact token at the start of a text block is stripped —
  the word "thought" appearing naturally in prose is never removed

**Why.** Some local models (gemma-12B observed, 2 occurrences) leak the
internal `thought` token as visible text at the start of a response. It is
a tokenizer artifact, not content — the same family as `<|tool_call|>`
which the reflect sanitizer already strips.

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
| FR-SETUP-11 | Worker validates the location before creating or adopting | 2 ✓ |
| FR-SETUP-12 | Incomplete instances are detected, not adopted | 2 ✓ |

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
- **And (OAuth path)** a login the user cancelled leaves the wizard unauthenticated and shows **no error** — closing the browser window is a decision, not a failure. Cancellation is carried as a typed field on `OAuthLoginResult`, never inferred from the error text. **Why this is a requirement and not an implementation note:** it was inferred from the text. `"Login cancelled"` was constructed in `oauth-service.ts` and string-compared in three other places, two of them in the frontend across the RPC boundary — so an English sentence was acting as a status code. Localizing it, or the SDK rewording its own abort message, would have silently turned every cancellation into an error dialog, and no type or test would have objected. The authority is `signal.aborted` on the login's own `AbortController`, which is what actually knows.
- **And (API key path)** the key is validated with a test API call before proceeding
- **And (API key path)** the key is stored in `~/.buddy/auth.json` with restrictive file permissions
- **Note (corrected 2026-07-28):** OpenAI-compatible ("custom") providers are **not available**, in the wizard or in Settings. The previous note claimed they were available via Settings → Add provider; that was never implemented — `ADD_PROVIDER_CANDIDATES` has never contained `custom`. The wizard *did* offer it, the inverse of what this line said, and that path did not work either: `configureProviderKey` accepts a `baseUrl`, validates it (NFR-SEC-18) and probes the endpoint with it, but never persists it. It is absent from `SetupConfig` and from `.pi/settings.json`, so a configured custom provider produced a session holding a credential with no address. The wizard entry point was removed rather than left as a choice that cannot work. See **FR-PROVIDER-01** for the real feature.

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
- **Amended (Jul 27):** adoption additionally ensures `.gitignore` covers
  `.buddy/` and `.pi/`, and initializes a git repository when the directory has
  none. Both are additive — no pre-existing file is modified — and both are the
  difference between working and quietly broken: without the ignore rules Buddy
  commits its own locks and session state into the user's history, and without a
  repository every auto-commit fails for the life of the install.

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
- **Then** it is refused only when it holds no identity at all — neither
  `SOUL.md` nor `USER.md` — which is the shape a failed setup leaves behind
- **And** a missing git repository or missing `.gitignore` rules are **repaired**
  during adoption rather than treated as disqualifying, since a hand-made
  instance legitimately arrives without them (FR-SETUP-10, amended)
- **Note on where the line sits:** the test is *unusable* versus *incomplete but
  fixable*, not *matches the template* versus *does not*. Requiring the full
  template would refuse instances that work perfectly well — the upstream
  template, or a directory carried between machines.
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
- **Then** a new Pi session is created via `SessionManager.create(rootDir, sessionsDir)` where `sessionsDir` is `<rootDir>/.buddy/sessions/` (NFR-SEC-19)
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
| FR-REFLECT-06 | Reflect child does not race the worker for the git index | 2 ✓ |
| FR-REFLECT-07 | Reflect child is bounded by a timeout | 2 |
| FR-REFLECT-08 | Empty sessions do not spawn a reflect | 2 ✓ |

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
- **When** `SessionManager.create(rootDir, sessionsDir)` succeeds
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

**FR-REFLECT-08 — Empty sessions do not spawn a reflect**

- **Given** a session ends with zero completed turns (no user message was sent)
- **When** the shutdown sequence runs
- **Then** no reflect child is spawned and no reflect-pending marker is written
- **Rationale:** a setup-only or immediately-closed session has nothing to
  reflect on. Spawning a reflect child for it wastes an LLM call and produces a
  log entry like "Session 01:05–01:05" with no content.

**FR-REFLECT-04 — Log output sanitizer (strip tool-call artifacts)**

- **Given** the reflect process writes a session block to the daily log
- **When** the output contains raw tool-call syntax leaked from the model (e.g. `to=functions.read code:` followed by JSON, or `<|tool_call|>` / `<|...|>` special tokens from local-model tokenizers)
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
| FR-INGEST-04 | Supported formats (csv/json/yaml/log, rejection reasons, no extensionless) | 1 ✓ |
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
- **When** it is markdown (`.md`), plain text (`.txt`), CSV (`.csv`), JSON (`.json`), YAML (`.yaml`, `.yml`), log (`.log`), or PDF (`.pdf`)
- **Then** the agent reads and discusses it normally
- **But when** it is XLSX, XLS, or another spreadsheet format (`.xlsx`, `.xls`, `.ods`)
- **Then** the attachment is rejected and the UI shows a spreadsheet-specific message suggesting CSV export — not the generic unsupported-format string
- **And** the English locale reads: "Spreadsheet files aren't supported directly — export to CSV from your spreadsheet app and attach that instead"
- **And** the Spanish locale reads: "Los archivos de hoja de cálculo no están soportados directamente — expórtalo como CSV desde tu aplicación de hojas de cálculo"
- **But when** it is DOCX or another unsupported document format (`.docx`, `.pptx`, `.epub`, etc.)
- **Then** the attachment is rejected and the UI shows a document-specific message suggesting export to text (`.md` or `.txt`)
- **But when** it is any other unsupported format
- **Then** the attachment is rejected and the UI shows the generic unsupported-format message
- **Implementation — allowlist:** Extend `TEXT_EXTENSIONS` in `shared/ingest-formats.ts` with `.csv`, `.json`, `.yaml`, `.yml`, `.log`. No conversion step — plain text read by the agent like `.md` and `.txt`.
- **Implementation — extensionless files:** Remove `""` from `TEXT_EXTENSIONS`. Extensionless paths (e.g. `README`, `LICENSE`, compiled binaries without extension) are rejected. Users with legitimate extensionless text files rename them (e.g. `README.txt`). A UTF-8 sniff gate is explicitly out of scope — regex allowlist only.
- **Implementation — rejection reasons:** `classifyAttachments()` returns structured rejections, not just filenames. Each rejected file carries a reason: `"spreadsheet"`, `"document"`, or `"unknown"`. Extension mapping lives in `shared/ingest-formats.ts` (e.g. `rejectionReasonForPath(path)`).
- **Implementation — UI:** `attachmentErrors` becomes (or is supplemented by) structured entries `{ name, reason }`. `InputBar.svelte` maps `reason` to locale keys: `unsupportedSpreadsheet`, `unsupportedDocument`, `unsupportedFormat` (generic fallback). Existing generic string `unsupportedFormat` remains for `"unknown"`.
- **Implementation — tests:** Unit tests in `ingest-formats.test.ts` cover each new extension and extensionless rejection. `attachment-classifier.test.ts` covers reason per rejection type. BDD scenarios in `file-ingest.feature` cover acceptance and spreadsheet guidance.
- **Note:** PDF is supported via local text extraction (FR-INGEST-06); `.pdf` is accepted and its text is injected into the prompt.
- **Note:** CSV is the cheapest path to "spreadsheet support" — no binary parser needed. Log files are a natural fit for technical users diagnosing errors with the agent.

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
| FR-CONSOL-08 | Consolidation state persisted per completed depth | 2 ✓ |
| FR-CONSOL-09 | Failure backoff and retry ceiling | 2 ✓ |
| FR-CONSOL-10 | Maintenance session enforces the zone model | 2 ✓ |
| FR-CONSOL-11 | Identity changes made by consolidation are surfaced | 2 ✓ |
| FR-CONSOL-12 | A consolidation that produced no output is a failure | 2 ✓ |
| FR-CONSOL-13 | A consolidation that corrupts the brain is a failure | 2 ✓ |
| FR-CONSOL-14 | The daily log records maintenance only when notable | 2 ✓ |
| FR-CONSOL-15 | The maintenance session's model is chosen per depth | 2 ✓ |
| FR-CONSOL-16 | Each cascade depth runs in its own session | 2 ✓ |

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

**FR-CONSOL-12 — A consolidation that produced no output is a failure**

- **Given** a consolidation prompt was sent to the maintenance session
- **When** `prompt()` resolves but the exchange carries `stopReason: "error"`, or
  produced no assistant message, or produced only empty content
- **Then** the depth is recorded `status: "fail"` with the provider's message,
  counts against the retry ceiling (FR-CONSOL-09), and **the maintenance
  counters do not advance**

**The incident, 2026-07-28.** A depth-1 run hit a misconfigured endpoint. The
provider answered 401; the SDK surfaced it as an assistant message with
`stopReason: "error"` and empty content rather than by throwing, so
`await session.prompt(...)` resolved normally and the entire success path ran:
`{"duration_ms": 22, "status": "success"}`, `lastDepth1` advanced, counters
reset, and `logs/2026-07-28.md` gained the line *"Maintenance cycle completed:
depth-1."* — which is then injected into every future session's context. The two
real depth-1 runs that day took 56s and 96s.

**Why this outranks the failed run itself.** Runs fail; that is expected and
FR-CONSOL-09 handles it. What this did was make the failure *indistinguishable
from success in every artefact*, so the maintenance clock advanced over work
that never happened. Whatever should have been promoted from `observations.md`
is not queued for the next run — it is marked handled. The symptom arrives a
month later as concepts that should exist and don't, with nothing to explain it.

**Why H3 and H4b missed it.** Both hardened this path, and both hardened it
against *exceptions*. A failed response is not an exception.

**FR-CONSOL-13 — A consolidation that corrupts the brain is a failure**

- **Given** a consolidation run has finished writing
- **When** the brain health report contains malformed frontmatter in a file that
  was not already malformed before the run
- **Then** the depth is recorded as failed, naming the files and problems, and
  the counters do not advance

**The gap this closes.** The brain is written by the model through `edit` and
`write`, and nothing verified the result. The linter existed but ran *before*
consolidation and looked only for frontmatter that was **missing** — so damage
of this shape was invisible to it in both directions. NFR-FORMAT-01 was a
convention nothing enforced.

**Observed:** the depth-1 of 2026-07-28 04:28 appended a second `---` block
below the existing one in four concept files instead of merging into it, giving
`local-link-routing.md` two `created` dates, one of them six days earlier than
the file. Recorded as a success.

**Before-and-after comparison is required, not incidental.** An instance
carrying inherited damage — one imported from another tool typically does —
would otherwise fail every consolidation forever, and the failure would say
nothing about the run that just ran. Only files the run itself broke count
against it.

**FR-CONSOL-14 — The daily log records maintenance only when notable**

- **Given** a consolidation finished successfully
- **When** it changed `SOUL.md` (FR-CONSOL-11) or refused an out-of-workspace
  access (FR-CONSOL-10)
- **Then** a maintenance entry is written to the daily log carrying those notes
- **And when** neither happened, **nothing is written** — the git commit is the
  record of a routine cycle

**Why the unconditional note was worse than useless.** It said only that the
machinery ran, in a file re-injected into every future session, so it competed
for attention with actual memory. Worse, it was emitted purely on
`completedDepths.length > 0`, without reference to whether any work had
happened — which is what made the 22 ms phantom run of 2026-07-28 read as
legitimate to anyone inspecting the log. A record that cannot distinguish a
real cycle from an empty one is not a record.

**The notes that matter survive**, and are now more visible for having nothing
around them. Git remains the log of routine cycles and, unlike a written note,
cannot claim work that was never done.

**Found by fixing it in the wrong place first.** The instruction "never record
the consolidation's own activity" was added to `consolidation.md`, and the next
run emitted the line anyway — because the runner writes it, not the model. An
instruction cannot govern behaviour that no model controls.

**FR-CONSOL-15 — The maintenance session's model is chosen per depth**

- **Given** a consolidation is about to run at depth N
- **When** the maintenance session is created
- **Then** the model is resolved from the depth by a single function
  (`modelForDepth(provider, depth)` in `shared/model-catalog.ts`, beside
  `fastModelForProvider`), and passed explicitly to the session
- **And** depths 1 and 2 use the provider's fast tier with
  `thinkingLevel: "off"`; depth 3 uses the configured model with default
  thinking
- **And** the usage of whichever model ran is recorded through
  `recordSessionUsage()` (NFR-SEC-14), so the cheaper tier shows up as a lower
  cost rather than as no cost
- **And when** the provider exposes no fast tier, the configured model is used
  with `thinkingLevel: "off"` — a missing tier is not a reason to skip the
  run, and thinking off still applies because the task is mechanical

**Why it is its own requirement, and not part of FR-WIKI.** It applies whether
or not the wiki exists, and it is a gap in what is already shipped:
`openRealMaintenanceSession` passes no model at all today, so every depth runs
on the configured one. The catalogue already carries the tiers
(`fastModelForProvider`, used by checkpoint reflect); nothing consumes them on
the consolidation path.

**Why the tier split falls where it does.** Depths 1 and 2 are mechanical —
rotate logs, rebuild indexes, reconcile counters, apply structural repairs that
deterministic code has already identified. Depth 3 groups, generalizes and
decides relocations, which is judgment, and judgment is what the cheap tier is
worst at. The provider has no pricing metadata to consult — `getAvailable()`
returns ids and names only — so the curated tiers in `shared/model-catalog.ts`
are the only source of "cheaper", and the decision belongs in one function
rather than at each call site.

**Why thinking is off for depths 1 and 2.** Local-model evals (Gemma 12B,
Aug 2026) showed that models with reasoning disabled follow consolidation
instructions more deterministically — fewer creative reinterpretations of
structural boilerplate, fewer hallucinated file paths. Mechanical tasks do not
benefit from extended reasoning, and the thinking tokens add latency and cost
without improving output quality. Pi SDK clamps `"off"` to the nearest
supported level if the model does not support disabling thinking entirely.

**Consequence for wiki synthesis (FR-WIKI-06).** Wiki health (FR-WIKI-05) is
fully deterministic and does not use LLM calls, so model tier is irrelevant.
Wiki synthesis (FR-WIKI-06) creates its own session on the fast tier — the
deterministic candidates step is zero cost, and the LLM judgment step is a
single prompt on structured input.

**FR-CONSOL-16 — Each cascade depth runs in its own session**

- **Given** a consolidation cascade targets depth N (where N > 1)
- **When** the runner iterates over the cascade depths
- **Then** each depth creates a fresh maintenance session
- **And** each session is disposed before the next depth begins
- **And** identity changes and refused paths are aggregated across all
  depth sessions for the final maintenance log entry
- **And** a single commit is made at the end covering all depths, as before

**Why.** A shared session accumulates context across depths — prompt history,
tool results, system messages. By depth 3 the effective window is exhausted,
and local models produce 0 tool calls (observed: 42+ turns accumulated,
0 actions at depth 3; isolated depth 3 produced 17 tool calls). Creating a
fresh session per depth gives each depth the full window.

| ID | Description | Phase |
|----|-------------|-------|
| FR-HEBB-01 | Intercept read tool calls | 2 ✓ |
| FR-HEBB-02 | Frontmatter update | 2 ✓ |
| FR-HEBB-03 | Exclusions | 2 ✓ |
| FR-HEBB-04 | Lazy commit | 2 ✓ |
| FR-HEBB-05 | Counters are created on first read | 2 ✓ |
| FR-HEBB-06 | Counters survive a whole-file rewrite | 2 ✓ |
| FR-HEBB-07 | Access is recorded from the paired tool events | 2 ✓ |
| FR-HEBB-08 | Counters are guarded in the maintenance session too | 2 ✓ |

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

**FR-HEBB-05 — Counters are created on first read**

- **Given** a brain file with frontmatter but no `access_count`
- **When** the agent reads it
- **Then** the worker adds `access_count: 1` and `last_accessed: today`,
  preserving every existing key and the body
- **And** a file with no frontmatter at all is left alone — creating a block
  would mean inventing a `summary`, which is consolidation's judgment

**The layer was inert for everything Buddy created.** `consolidation.md` tells
the model it must "never write `access_count` or `last_accessed` — the worker
updates those automatically", and the worker returned early for any file
lacking `access_count`. Between the two rules nobody created them, so a concept
the agent distilled was born without counters and could never acquire them: it
scored zero for ever, and consolidation demoted it.

**Consequences observed.** On an instance holding both imported and
Buddy-created files, all 14 native files lacked counters while every imported
one had them — so promotion could only ever favour content from the previous
tool, and the 2026-07-28 depth-1 demoted three native concepts on that basis.
On a *fresh* install nothing has counters at all, which means promotion and
demotion by use — the entire purpose of FR-HEBB — never happened for any user.

**Bootstrapping on read rather than by migration** is what makes existing
brains repair themselves: a file heals the first time it is consulted, nothing
is rewritten that nobody opens, and no install needs a migration step.

**Starting at 1, not 0:** the read that creates the fields is a real access and
counts as one.

**FR-HEBB-06 — Counters survive a whole-file rewrite**

- **Given** a brain file carrying `access_count` / `last_accessed`
- **When** a tool writes the whole file and reconstructs its frontmatter
- **Then** those two fields are restored to the values they held before the
  write; every other key and the body are kept exactly as written
- **And** a file created during the turn, or one deliberately rewritten without
  frontmatter, is left alone

**Why a rule was not enough.** `AGENTS.md` already told the agent "never edit
these fields on existing files". On 2026-07-29 a local model failed eight
consecutive `edit` calls, gave up, and rewrote `user/inbox.md` whole; the
frontmatter came back from memory with `access_count: 7` reduced to `1`. Seven
sessions of signal gone, in a diff that reads as a plausible metadata bump.

The instruction did not fail — it did not apply. The model was not editing the
fields; it was regenerating a file that happens to contain them. No wording
about editing fields covers that, which is why this is enforcement rather than
guidance.

**Capture before, restore after.** Reading the file after the write would read
the damage. A failed tool call restores nothing, because it changed nothing and
writing a remembered value over the current file would be the guard causing the
corruption it exists to prevent.

**FR-HEBB-07 — Access is recorded from the paired tool events**

- **Given** the agent consults a brain file
- **When** the tool call finishes successfully
- **Then** the access is recorded, using the path from the matching
  `tool_execution_start` — `tool_execution_end` carries none
- **And** a `grep` aimed at a specific file counts as consultation; a `grep`
  over a directory does not

**The layer had never recorded a single access, on any install.** Not because
the tracker was wrong — it works correctly in isolation — but because it was
never called. `tool_execution_end` carries `toolCallId`, `toolName`, `result`
and `isError`, and no `args`, so `extractToolInfo(event).path` was always
undefined and the `info?.path` guard skipped every read in silence.

**Why it looked healthy.** The adjacent `turnDirty` flags test only the tool
*name*, so auto-commit worked perfectly throughout. Every visible symptom of a
functioning pipeline was present.

**Found by a user question**, not by a test: a file at `access_count: 0` was
still at 0 after a session that demonstrably read it. FR-HEBB-05 had been built
on top of this and could not have worked either — one half of a mechanism whose
other half never ran.

**The pairing is not duplicated.** `SessionTracker` already maintained the
call-id → args map for its own bookkeeping; `recordEvent` now returns the
resolved call rather than the lifecycle keeping a second copy that could
disagree with it.

**`grep` on one file counts.** Searching inside a document is consultation, and
the cheaper way to do it; charging it nothing would bias the signal towards
whichever tool happens to be less efficient. A recursive `grep` does not count —
that is brute force, and crediting every file under a tree for one search would
drown the signal it is meant to measure.

**FR-HEBB-08 — Counters are guarded in the maintenance session too**

- **Given** a consolidation session writes to a brain file
- **When** the write changes or adds `access_count` / `last_accessed`
- **Then** the fields are restored (if they existed) or stripped (if added)
- **And** the guard uses the same mechanism as the chat session (FR-HEBB-06)
- **Rationale:** the guard was wired only into the chat session
  (`session-lifecycle.ts`), so metadata damage appeared in every consolidation
  eval run (C1/C2/C3) but never in chat. A guard that covers half the write
  paths is half a guard.

**FR-HEBB-04 — Lazy commit**

- **Given** Hebbian frontmatter updates have been flushed
- **When** the next content commit occurs or the session ends
- **Then** the frontmatter changes are included in that commit
- **And** no separate per-turn metadata-only commits are created

### 3.9b Write Guards (FR-GUARD)

| ID | Description | Phase |
|----|-------------|-------|
| FR-GUARD-01 | Heading-snapshot guard prevents structural destruction | 2 ✓ |
| FR-GUARD-02 | Edit-failure recovery hints and prompt rule | 2 ✓ |
| FR-GUARD-03 | Post-consolidation filename validation and broken-link repair | 2 ✓ |

**FR-GUARD-01 — Heading-snapshot guard**

- **Given** the agent calls `write` or `edit` on a file inside `agent_brain/`
  or `logs/`
- **When** the tool call completes without error
- **Then** the guard compares the set of `#` and `##` headings before and after
- **And** if any heading present before the write is missing after it, the
  file is restored to its pre-write content and the tool result is replaced
  with an error explaining which headings were lost
- **And** if the file had a frontmatter block (`---` delimited) before the
  write and the frontmatter is missing or empty after it, the file is
  restored to its pre-write content
- **And** the guard fires in both the chat session and the maintenance session

**What it does not do:**

- It does not block new headings being added — only disappearance is a fault.
- It does not protect heading *order* — reordering is a legitimate edit.
- It does not protect files outside `agent_brain/` and `logs/` — user files
  are the user's to restructure.
- It does not apply when the tool call failed (`isError: true`) — a failed
  call changed nothing, and restoring would overwrite the current state.

**Why headings, not size or diff hunks.** Size guards have false positives:
`observations.md` and `deferred.md` legitimately shrink when entries are
promoted or resolved. Diff-hunk analysis is fragile and ambiguous. Headings
are structural anchors that define the file's schema — their disappearance
is always damage, never a legitimate edit (the model that wants to merge
sections should move content under the surviving heading, not delete the
other).

**Why both sessions.** The worst observed destruction happened in
consolidation (C2, C3), not chat. A guard installed only on the chat
session would miss the highest-risk path — repeating the Hebbian guard's
original gap (FR-HEBB-08).

**FR-GUARD-02 — Edit-failure recovery**

When `edit` fails, local models often retry the same wrong anchor and then
fall back to a whole-file `write` — the #2b failure mode. FR-GUARD-01 blocks
the destructive `write` but leaves the model stuck. This FR adds recovery
guidance so the model can succeed with `edit` instead.

- **Given** the agent calls `edit` and the tool returns an error
- **When** the error message contains `Could not find the exact text` or
  `Could not find edits[` 
- **Then** the tool result is enriched with a hint to re-read the file and
  copy the anchor text exactly
- **And when** the error message contains `Found N occurrences`
- **Then** the tool result is enriched with a hint to include more surrounding
  lines to make the anchor unique
- **And when** the error message contains `No changes made`
- **Then** the tool result is enriched with a hint that the replacement is
  identical to the original
- **And when** the error is from a non-`edit` tool, or the message matches
  none of the known patterns
- **Then** the result is passed through unchanged
- **And** enrichment fires in both the chat session and the maintenance session
  via `afterToolCall`

**Prompt rule (agents-base.md):**

- **Given** the global base prompt
- **When** the model needs to modify an existing file in `agent_brain/` or
  `logs/`
- **Then** the prompt instructs: after an `edit` error, re-read the file and
  retry with a literal anchor from the re-read — never fall back to `write`
  on an existing brain or log file
- **And** if the edit still fails after re-read, stop and inform the user
  rather than rewriting the whole file

**FR-GUARD-03 — Post-consolidation validation**

Deterministic repairs after consolidation completes and before the runner
commits. These are `detect-and-repair` — distinct from FR-CONSOL-13's
`detect-and-fail` for ambiguous frontmatter corruption.

**Order:** `assertNoNewBrainDamage` → filename validation → broken-link
repair → `commitAll`.

**Filename validation (15.3):**

- **Given** consolidation has finished and produced git changes
- **When** the runner scans files added during the run
- **Then** any filename containing spaces, uppercase letters, or characters
  outside `[a-z0-9._-/]` is renamed to a slug-normalized path
- **And** markdown links in touched files that pointed at the old name are
  rewritten to the new name
- **And** filenames that already conform are left unchanged

**Broken-link repair (15.4):**

- **Given** filename validation has completed
- **When** the runner scans markdown files touched during the run
- **Then** each relative markdown link whose target does not exist on disk
  is stripped to plain text (link syntax removed, display text kept)
- **And** valid links and external (`http://`, `https://`) links are unchanged
- **And** each repair is logged via `logEvent`

**What it does not do:**

- It does not scan the entire repo — only files created or modified during
  the consolidation run.
- Broken-link repair is hygiene, not data-loss prevention — stripping a link
  does not restore deleted content.

### 3.9c Pi SDK compatibility (FR-SDK)

| ID | Description | Phase |
|----|-------------|-------|
| FR-SDK-01 | Streaming works with delta-only `message_update` events | Maint ✓ |
| FR-SDK-02 | Session management APIs remain compatible after SDK upgrade | Maint ✓ |
| FR-SDK-03 | Sidecar deep imports resolve in the target Pi SDK version | Maint ✓ |

**FR-SDK-01 — Delta-only streaming**

- **Given** the Pi SDK emits `message_update` events during an assistant turn
- **When** each event carries only `assistantMessageEvent.delta` (no cumulative
  `message` or `partial` fields)
- **Then** the chat controller assembles and displays the full assistant text
- **And** test fixtures (`FakeSession`) emit the same delta-only shape

**FR-SDK-02 — Session management compatibility**

- **Given** Buddy boots a chat session, forks a reflect session, or opens a
  maintenance session
- **When** the Pi SDK is upgraded
- **Then** `SessionManager.create(rootDir)` and `SessionManager.forkFrom(file,
  rootDir, forkDir)` remain callable with the same argument shapes
- **And** `createAgentSession()` accepts Buddy's existing options (`cwd`,
  `agentDir`, `resourceLoader`, `sessionManager`, `excludeTools`, `tools`,
  `customTools`, `modelRuntime`, `noTools`)

**FR-SDK-03 — Sidecar deep import paths**

- **Given** the production sidecar binary wires OAuth and HTTP dispatch via
  deep imports into Pi SDK internals
- **When** `@earendil-works/pi-coding-agent` is upgraded
- **Then** `bun-oauth.js` and `http-dispatcher.js` paths still resolve on disk
- **And** `sidecar-entry.ts` imports are updated if paths moved

### 3.10 System Prompt (FR-PROMPT)

| ID | Description | Phase |
|----|-------------|-------|
| FR-PROMPT-01 | System prompt assembly (identity and rules) | 1 ✓ |
| FR-PROMPT-02 | Session-start context message | 1 ✓ |
| FR-PROMPT-03 | Global base prompt (agents-base.md) | 2 ✓ |
| FR-PROMPT-04 | Hidden context injection at session boot | 2 ✓ |
| FR-PROMPT-06 | Edit batching guidance for append-heavy files | 2 ✓ |
| FR-PROMPT-07 | Queue file edit anchoring guidance | 2 ✓ |

**FR-PROMPT-01 — System prompt assembly**

- **Given** a session is starting
- **When** the system prompt is built
- **Then** it includes only stable identity and rules layers: `agents-base.md`, `AGENTS.md`/`CLAUDE.md`, `SOUL.md`, `USER.md`, current date/time
- **And** it does **not** include logs, deferred items, or first-run interview instructions
- **And** it is passed to Pi via `DefaultResourceLoader({ systemPromptOverride: () => prompt })`

**FR-PROMPT-05 — "Unpersonalized profile" means "identical to the template"**

- **Given** `agent_brain/identity/USER.md`
- **When** the worker decides whether to inject the first-conversation setup
  interview
- **Then** the interview is injected only if the file is absent, empty, or
  still byte-identical to the shipped template (whitespace-normalised)
- **And** when no template is available for comparison, a non-empty profile
  counts as personalized

**The detector used to search for a literal `**Name:**` line.** A profile that
had grown to say `- **Full name:** Juan Jesús …` failed that test, so an
instance in daily use reported "placeholder" on **every session**. Buddy then
injected a block opening "This is your first conversation together" which
instructs the model to *rewrite USER.md completely*.

Observed 2026-07-29: an assistant holding a 200-line profile of its user asked
them to introduce themselves. Earlier runs had rewritten that profile — not the
model's initiative, but exactly what the injected block told it to do.

**Why the template and not a better key search.** Accepting `**Full name:**`
too would have moved the failure rather than removed it: the profile is
*designed* to grow, the agent maintains it, and nothing requires it to keep
English key names in a Spanish instance. The template is the one reference that
does not depend on a convention the agent is free to change.

**The fallback direction is deliberate.** With no template to compare against,
a non-empty profile counts as personalized. A missed interview costs one
unasked question; a false one tells a months-long user that their assistant
does not know them, and orders their profile overwritten.

**FR-PROMPT-02 — Session-start context message**

- **Given** a session is starting
- **When** session context is assembled
- **Then** episodic and transient content is built as a separate message body: the current date in plain language, `logs/index.md`, last session log, due/overdue deferred items, first-run interview (when USER.md is a placeholder)
- **And** due deferred items are formatted so the agent surfaces them proactively in its first reply
- **And** when no context sections apply, the message is empty (no injection)

**FR-PROMPT-03 — Global base prompt**

- **Given** a session is starting
- **When** the system prompt is assembled
- **Then** `~/.buddy/prompts/agents-base.md` is read first and forms the base behavioral layer
- **And** it defines: available tools, what's automatic (git, directory creation, session logging), agent limits (no bash, no shell), Buddy identity anchor, and **`~/.buddy/docs/` as authoritative self-reference** — for questions about capabilities, memory, or how Buddy works, read docs before answering (do not infer from instance files like `AGENTS.md`)
- **And** it includes the **knowledge routing rule** (NFR-ROUTE-01/02): a section that tells the agent where to store captures (user knowledge → `wiki_file`, tasks → inbox/projects, agent learning → `agent_brain/`) and where to search for retrieval (user knowledge → `wiki_search`, agent context → `agent_brain/` indexes, past conversations → logs)
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

**FR-PROMPT-06 — Edit batching guidance**

- **Given** the global base prompt (`agents-base.md`)
- **When** the model needs to modify brain or identity files
- **Then** the prompt instructs it to issue one `edit` call per logical change, not multiple edits batched in a single turn
- **Rationale:** local models (Qwen 27B, Gemma 12B) fail `edit` calls at high
  rates when the `oldText` anchor is long or when multiple edits target the
  same file in one turn. A batched edit where the second depends on the first's
  output fails when the first changes line positions. An earlier version also
  recommended `write` for append-heavy files, but the depth-3 experiment showed
  that models use `write` destructively — replacing structured templates with
  summaries. Removed to avoid encouraging whole-file rewrites.

**FR-PROMPT-07 — Queue file edit anchoring guidance**

- **Given** the global base prompt (`agents-base.md`)
- **When** the model needs to append to or edit `deferred.md` or
  `observations.md`
- **Then** the prompt instructs it to anchor `edit` calls on a section
  heading (`## `), never on `---` or frontmatter delimiters
- **Rationale:** `---` appears in frontmatter and as a horizontal rule —
  using it as an `oldText` anchor triggers `Found N occurrences ... must be
  unique`, pushing the model into the write-fallback path (#2b). Section
  headings are unique by design.

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
- **And** the user can authenticate additional providers inline ("Add provider") without leaving settings — Anthropic, OpenAI and Google only (see FR-PROVIDER-01)
- **Known defect (FR-PROVIDER-01):** the provider dropdown is built from `[...new Set($models.map(m => m.provider))]`, and `loadAuthenticatedModels` filters `custom` out of that list. Any authenticated provider absent from the model list therefore has no `<option>`, so no option is `selected` and the browser falls back to showing the first one — the dropdown names a provider the user is not using. Unreachable today because `custom` can no longer be configured; it becomes live again the moment it can.

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
| FR-COST-05 | Budget gate aborts an in-flight cascade | 2 ✓ |
| ~~FR-COST-06~~ | ~~Usage shown in tokens and messages~~ | — rejected |

**Spend is tracked globally, never per provider (decision, 2026-07-28)**

`usage.json` records `{ months: { "YYYY-MM": { totalCost, totalTokens,
messageCount } } }`. There is no provider dimension and there should not be one.
The question a user actually asks is "what is this app costing me", and
answering it per provider would push them back to adding up three dashboards —
which is the work the Usage panel exists to remove. Each provider's own console
remains the place to reconcile a bill; Buddy's job is the total.

This settles the question FR-PROVIDER raised. A local model (Ollama, LM Studio)
carries a `cost` of zero, so it contributes nothing to the monthly total and
can never move the cap. That is correct and deliberate: running a model on your
own machine costs no API money, and a cap denominated in dollars must not be
consumed by it.

**FR-COST-06 — rejected (2026-07-28)**

Proposed: show token and message counts beside the currency figures, so that
heavy zero-cost usage (a local model) would be distinguishable from no usage.
Rejected on the same day it was written, and the reasoning is worth keeping
because the mistake is easy to repeat.

The argument for it was that `$0.00 / $10.00` after a day of work "looks
broken". It does not. It is the accurate answer, and for a user paying nothing
it is the *good* answer — the panel exists to tell them what they will be
charged, and the honest reply is "nothing". Token counts answer a different
question, one that interests whoever builds the app and not the person using
it. Buddy's user is someone who wants to know whether the bill at the end of
the month will be a surprise; a second number they cannot act on is noise
competing with the one that matters.

There is also no audience for it. Configuring a local endpoint is inherently a
technical act, and someone who has done it can read `$0.00` without help.

**The general rule this establishes:** the Usage panel answers "what will I be
charged". Anything that does not serve that question does not belong in it,
however cheap it is to render and however available the data already is. The
data being one line away from display is an argument about cost, not about
whether it should be there.

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
| FR-BRAIN-08 | Preference tracking in USER.md (current state, no history) | 3 ✓ |
| FR-BRAIN-09 | "What did we learn about the user?" consolidation step | 3 ✓ |
| FR-BRAIN-10 | Cross-domain principle abstraction (weekly depth 2) | 3 ✓ |
| FR-BRAIN-11 | Working memory precision eval (manual dev tool) | 3 ✓ |
| FR-BRAIN-12 | Forget mechanism | — deferred |
| FR-BRAIN-13 | Extended memory retrieval eval | — deferred |

**FR-BRAIN-01 — AGENTS.md behavioral rules**

- **Given** a fresh buddy instance with only the template content
- **When** the user talks to the agent about tasks, ideas, decisions
- **Then** the agent routes captures per NFR-ROUTE-01: user knowledge → `wiki_file`, actionable items → `user/inbox.md` / `user/projects/`, agent learning → `agent_brain/`
- **And** retrieval follows NFR-ROUTE-02: `wiki_search` for user knowledge, `agent_brain/` navigation for agent context, logs for conversation history
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
- **Validated:** 5 eval runs (depth 1–3) against the consolidation test fixture

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
  - No `agent_brain/` file has **malformed** frontmatter: a second `---` block stacked below the first, a key repeated inside one block, or an unterminated block. Distinct from the check above, which only ever asked whether frontmatter was *absent* — corruption of this shape was invisible to it, and it is exactly what a consolidation writes when it appends instead of merging (FR-CONSOL-13). A `---` used as a horizontal rule in the body is not frontmatter and must not be flagged
  - Core files exist with correct format (SOUL.md, USER.md, AGENTS.md or CLAUDE.md, deferred.md)
  - Every directory with more than one file has an `index.md` (documented exceptions: USER.md parent pattern)
  - Files exceeding size threshold are flagged for potential split
- **And** the report is injected into the consolidation prompt (same pattern as Hebbian report) or returned to the user if invoked on demand
- **Note:** Principle 3.2 — list/count/compare is worker code, not LLM judgment. Index generation can be fully programmatic when `summary` fields are present (NFR-FORMAT-01).

**FR-BRAIN-08 — Preference tracking in USER.md**

- **Given** a buddy instance (fresh or existing)
- **When** the user changes a preference during a session (e.g., pauses BJJ, switches work schedule, corrects language preference)
- **Then** `agent_brain/identity/USER.md` records the current state under `## Preferences` — updated in place, not accumulated as history
- **And** change history lives implicitly in daily logs (where reflect captured the signal) and git history — not in USER.md itself
- **Design decision:** The original design (PersonaMem-v2 inspired) called for evolution history with dates and previous states in USER.md. This was dropped because Buddy's consolidation architecture already solves the problem: consolidation keeps USER.md current, and logs preserve the full history. Accumulating history in USER.md would bloat a file loaded into every session without adding decision-making power.
- **Template (new instances):** The bundled `USER.md` template ships with a `## Preferences` section:

  ```markdown
  ## Preferences

  Keep current — update when preferences change, don't accumulate history here.
  ```

- **Migration (existing instances):** `ensureUserMdSections()` in `backends/brain-migration.ts` reads `USER.md`, checks for `## Preferences` via heading regex, and appends the section if absent. Runs at session boot and pre-consolidation. After the section exists, the check is a no-op.
- **Why code, not prompt:** Deterministic across all models (including local); no tokens spent on structural detection; same pattern as `computeBrainHealthReport()` (FR-BRAIN-07).
- **Prompt changes:** `process-conversation.md` Step 4 (Detect observations) gains a trigger for preference changes. `consolidation.md` daily steps instruct the LLM to update `## Preferences` when today's log reveals a change — but only within a section that already exists (scaffolded by the worker).
- **Size discipline:** USER.md must stay under ~60 lines. When a section grows, detail is extracted to satellite files in `identity/` (e.g. `health.md`, `people.md`) with a one-line summary and link in USER.md. Enforced in the consolidation prompt (step 3b), not during interactive sessions.
- **Testable:** Conversation eval — after a session where the user changes a stated preference, consolidation updates USER.md with current state. Unit test — `ensureUserMdSections()` appends `## Preferences` when missing, leaves file unchanged when present.

**FR-BRAIN-09 — "What did we learn about the user?" consolidation step**

- **Given** daily consolidation (depth 1) runs after one or more sessions today
- **When** the consolidation prompt is built
- **Then** it includes an explicit step (between journal write and inbox triage — Step 3b in `consolidation.md`):
  > Review today's interactions. Did the user reveal: (a) new preferences or opinions? (b) changes to existing preferences? (c) personal facts not yet in USER.md? (d) corrections to previously stored information? If yes, update USER.md accordingly.
- **And** this step runs even when the day had no dramatic events — implicit signals count (wording choices, corrections, repeated behaviors mentioned in passing)
- **And** reflect (process-conversation) detects preference-change signals and writes them to `observations.md` — consolidation reads those signals and updates USER.md in step 3b
- **Scope:** Prompt/template only (`bundled/prompts/consolidation.md`, `bundled/prompts/process-conversation.md`). No new app code beyond FR-BRAIN-08 section scaffolding.
- **Testable:** Conversation eval — session with implicit preference signal (e.g., user mentions they stopped an activity) → next consolidation updates USER.md without user explicitly asking.

**FR-BRAIN-10 — Cross-domain principle abstraction**

- **Given** weekly consolidation (depth 2) runs with accumulated preference data in `USER.md` (FR-BRAIN-08 operational)
- **When** the depth 2 extension executes
- **Then** it includes a principle-extraction step:
  > From accumulated preferences and behaviors in USER.md, identify underlying principles that explain multiple preferences (require 3+ data points). E.g.: BJJ + café work + complex-systems thinking → "values structured constraints that produce emergent adaptation." Store in `## Principles` in USER.md. Only add principles with strong evidence; omit the section content if nothing qualifies.
- **And** `## Principles` is scaffolded by extending the worker migration (`ensureUserMdSections()`) — created empty if missing before the LLM runs. This scaffolding is part of FR-BRAIN-10, not FR-BRAIN-08
- **Depends on:** FR-BRAIN-08 and FR-BRAIN-09 (needs preference data flowing before abstraction is meaningful)
- **Testable:** Conversation eval after several weeks of preference accumulation — depth 2 produces at least one principle with cited evidence. Unit test — migration scaffolds `## Principles` when absent.

**FR-BRAIN-11 — Working memory precision eval (manual tool)**

Measures whether USER.md + concepts are accurate and current — not whether the agent can navigate to information in logs (that's FR-BRAIN-13).

- **Given** a buddy instance with populated memory files
- **When** a developer runs `npx tsx scripts/eval-markov.ts <buddy-dir>`
- **Then** the tool loads questions from `<buddy-dir>/eval-questions.json` (or `--questions <path>`) and for each question:
  1. Asks the model using **only** working memory context (USER.md + concepts/index.md)
  2. Asks again with full context (memory + all logs)
  3. Compares keyword hits to detect gaps
- **And** questions are categorized as:
  - **profile** — stable facts (identity, work, health, preferences). A gap means USER.md is incomplete.
  - **currency** — facts that evolved over time (events resolved, preferences changed). A gap means memory is stale — logs have the current version but consolidation hasn't updated USER.md.
- **And** questions live in an external JSON file (not in the codebase) because they contain instance-specific personal data
- **And** the tool is NOT part of the test suite — run manually to evaluate consolidation quality
- **Depends on:** FR-BRAIN-08/09 operational; question bank designed per instance
- **Testable:** Script runs against any instance; report shows profile accuracy %, currency accuracy %, and per-question detail.

**FR-BRAIN-12 — Forget mechanism** *(deferred — needs design)*

Structured deletion with consolidation barriers (`[REDACTED]` markers, cross-layer propagation, git history interaction) is documented in [personamem-memory-improvements.md](personamem-memory-improvements.md) but requirements are not clear enough to spec. Deferred until design answers: what triggers forget, how it propagates across memory layers, tool vs convention, and interaction with git history.

**FR-BRAIN-13 — Extended memory retrieval eval** *(deferred — needs design)*

FR-BRAIN-11 measures *working memory precision*: whether USER.md and concepts are accurate and current. It deliberately does not test whether the agent can *navigate* to information stored elsewhere (logs, projects, satellite files) — only whether the profile is right.

FR-BRAIN-13 fills the complementary gap: can the agent find and return correct information from extended memory using its retrieval tools? This requires a different eval architecture:

- **Agent-based, not context-dump:** The model gets read/grep tools and must navigate the file hierarchy (indexes → files) to find answers, simulating real retrieval behavior.
- **Currency under contradiction:** Logs may contain conflicting information over time (preference changed, event status updated). The eval must verify the agent surfaces the *current* version, not a stale one.
- **Retrieval path quality:** Not just "did it find the answer" but "did it follow progressive disclosure" (index → file, not brute-force grep over all logs).

Open design questions: eval harness for tool-use sessions (Pi session with tools enabled?), cost per run (tool-use sessions are heavier than prompt-only), question design for retrieval vs recall, scoring for partial retrieval (found the file but extracted wrong section).

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
| FR-SHELL-07 | About dialog icon on Linux/Windows | 2 ✓ |
| FR-SHELL-08 | Hide empty Window menu on Linux | 2 ✓ |
| FR-SHELL-09 | Native menu label i18n (es/en) | 2 ✓ |

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

**FR-SHELL-07 — About dialog icon**

GTK and Windows About dialogs only show an app icon when `AboutMetadata.icon`
is set. macOS uses the bundle icon and needs no change.

- **Given** the app runs on Linux or Windows
- **When** the user opens the About dialog from the app menu
- **Then** the dialog shows the Buddy app icon
- **And** the icon is embedded from `icons/128x128@2x.png` via `include_bytes!`
- **And** `Cargo.toml` enables the Tauri `image-png` feature

**FR-SHELL-08 — Hide empty Window menu on Linux**

On GTK/Wayland, `.minimize()` and `.close_window()` render as blank menu items,
leaving an empty "Window" submenu.

- **Given** the app runs on Linux
- **When** the native menu bar is built
- **Then** no "Window" submenu appears
- **And when** the app runs on macOS or Windows
- **Then** the Window submenu is unchanged (minimize + close window)

**FR-SHELL-09 — Native menu label i18n**

Custom submenu names and the Settings menu item are hardcoded in English in the
Rust shell. Predefined items (Cut, Copy, Paste, etc.) are localized by
GTK/muda from the system locale — out of scope.

- **Given** `~/.buddy/config.json` exists with `"language": "es"`
- **When** the native menu bar is built at startup
- **Then** the Edit submenu is labelled "Editar"
- **And** the Settings item is labelled "Ajustes…"
- **And** the Window submenu (non-Linux) is labelled "Ventana"
- **And when** no config exists or `language` is unset
- **Then** the shell falls back to the system locale via `sys_locale`
- **And when** neither config nor system locale is Spanish
- **Then** English labels are used ("Edit", "Settings…", "Window")

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
| FR-WIKI-01 | Wiki-style KB for user's personal knowledge | post-MVP |
| FR-WIKI-02 | Ingest documents into wiki | post-MVP |
| FR-WIKI-03 | Cross-reference and backlinks | post-MVP |
| FR-WIKI-04 | Search and retrieve from wiki | post-MVP |
| FR-WIKI-05 | Wiki health: post-write consistency + heartbeat audit | post-MVP |
| FR-WIKI-06 | Emergent concepts synthesized as heartbeat task | post-MVP |
| FR-WIKI-07 | The wiki is always on | post-MVP |
| FR-WIKI-08 | Filing shows progress in plain language | post-MVP |
| FR-WIKI-09 | Lightweight capture from conversation (code-only, no child session) | post-MVP |

**Scheduling (2026-07-28, revised 2026-08-10).** Post-MVP, but no longer
optional. The knowledge routing redesign (NFR-ROUTE-01) makes the wiki the
default destination for user knowledge. Without it, the routing rule has no
structured target and falls back to loose files — the ambiguity that prompted
the redesign. The wiki is always on (FR-WIKI-07) and bootstrapped on first
use.

The original scope test ("Buddy without the wiki is still Buddy") remains true
for capture and task management. What changed is that the separation between
agent memory and user knowledge (principle 5 in `app-design-principles.md`)
needs the wiki to be operationally clear. The wiki is infrastructure for that
separation, not a power feature layered on top.

**Design (2026-08-02).** Design rationale, rejected alternatives, and scope
decisions are in `docs/app-design-principles.md` (principle 11). What follows
is the part that binds implementation: the acceptance criteria, and the
decisions this project has to hold to because they touch code that already
exists.

**Reconciliation is specified (2026-08-10).** The enrichment procedure —
match detection (normalized title → tag overlap → no match), append-by-section
mechanics, size guard (80 content lines), and connection set-union — is now
encoded in FR-WIKI-02 as acceptance criteria. Design rationale in
`wiki-design.md` (D12). Key-point deduplication is deferred as a non-blocking
improvement.

**Tool surface, and why it is split.** The interactive session gets two tools,
`wiki_search` and `wiki_file`. Health functions (`wiki_check`,
`wiki_repair_links`, `wiki_regenerate`) run as deterministic code inside
`wiki_file` (post-write) and the heartbeat (audit) — they are not LLM tools.
Synthesis functions (`wiki_synthesis_candidates`, `wiki_create_page`) run in a
dedicated heartbeat synthesis session with its own cycle and state, decoupled
from the consolidation cascade (see FR-WIKI-05, FR-WIKI-06).

**Path constants live in `shared/brain-paths.ts`.** `user/wiki/`, its `.meta/`
subdirectory and the generated `tags.md` / `glossary.md` are named there like
every other location, for the reason that module exists: a layout spelled as
string literals across files fails silently when one of them is mistyped.
Naming them there is not containment — `backends/containment.ts` remains the
only authority on where a path points (NFR-SEC-16), and it is what a
model-supplied `category` or `title` must be resolved through before it becomes
a directory.

**Knowledge routing (applies to all FR-WIKI).** The wiki makes explicit a
boundary that capture previously blurred: what the agent stores for itself
(`agent_brain/`) vs what it stores for the user (`user/wiki/`). The routing
rule (NFR-ROUTE-01) and its retrieval counterpart (NFR-ROUTE-02) are declared
in `agents-base.md` (FR-PROMPT-03) and govern both storage and search. Design
rationale in `wiki-design.md` (D12).

**FR-WIKI-01 — User personal KB**

- **Given** the buddy instance is configured and the wiki is enabled (FR-WIKI-07)
- **When** the user shares knowledge worth preserving long-term (notes, ideas, concepts, document summaries)
- **Then** the agent files it into `user/wiki/` as interconnected markdown pages
- **And** pages carry frontmatter (`tags`, `sources`, `created`, `updated`, `summary`) and backlinks
- **And** this is the user's knowledge base — distinct from `agent_brain/` (the agent's learned context about the user)
- **And** the agent's system prompt includes routing guidance: user knowledge → wiki, actionable items → inbox/projects, agent learning → `agent_brain/`
- **And** Hebbian tracking does not apply: it covers `agent_brain/` only, and wiki pages carry no `access_count`/`last_accessed`
- **Content language:** wiki pages are written in the instance language (`config.json` → `language`). Section headings use a localized map (`WIKI_SECTION_HEADINGS` in `wiki-format.ts`), and `wiki_file`'s tool description tells the LLM to write prose (title, summary, key points, examples) in that language. Tags stay as lowercase English slugs (they're identifiers, not prose). Reading is positional (H2 order), not heading-name-based, so enrichment and backlinks work regardless of language. **Scaling note:** this approach injects language into a single tool description; document ingest (FR-WIKI-02) will need the same signal threaded into the child-session extraction prompt. Adding a third language requires one entry in `WIKI_SECTION_HEADINGS` and one branch in the description builder.
- **Derived files:** on each `wiki_file` run, `index.md` and `glossary.md` are regenerated from page frontmatter. `index.md` and `glossary.md` headings use the instance language (`# Wiki`, `# Glossary` / `# Glosario`). The glossary lists each page alphabetically with the **first sentence** of `summary` (not a truncated mid-sentence excerpt). `tags.md` is **not** regenerated on every `wiki_file` call — tag-scoped search is handled by `wiki_search`; `tags.md` remains available for maintenance tools only (`regenerateTagsFile`). Neither derived file is injected at session start; the agent reads them on demand when exploring the wiki holistically.
- **Bootstrap:** the structure (`index.md`, category directories, `.meta/log.md`) is created by `wiki_file` on first use, when it finds no wiki. Nothing is created at setup, and no empty wiki is advertised to the agent.

**FR-WIKI-02 — Document ingest to wiki**

- **Given** the user provides a document (via drag & drop, attach, or path)
- **When** they ask the agent to "add to wiki", "save this knowledge", or similar
- **Then** `wiki_file` extracts key concepts through a **fresh, toolless child session** — not a fork, so the whole window is available for the source document, and toolless so every write stays in deterministic code
- **And** the extraction runs on the provider's fast tier (`fastModelForProvider`), like checkpoint reflect
- **And** the child's token usage is recorded through `recordSessionUsage()` — this feature is expensive, and unrecorded cost is worse than visible cost
- **And** pages are created or enriched, reconciling against existing content (no duplicates), with the index, backlinks and derived files updated by code
- **And** the agent confirms what was filed and where
- **Reconciliation (match detection):** three tiers, resolved in order: (1) normalized title match (slugified: lowercase, strip accents, collapse whitespace) → enrich; (2) high tag overlap (≥3 shared tags) → a second cheap toolless child call decides `"enrich"` or `"create"`; (3) no match → create new page.
- **Enrichment procedure (append-by-section):** new key points are appended at the end of `## Key points`; new examples at the end of `## Examples`; frontmatter summary is left unchanged; tags are set-unioned; sources list is extended; `updated` is set to today. No rewriting, no reordering — the invariant is satisfied by construction.
- **Size guard:** if the enriched page would exceed 80 content lines (excluding frontmatter and `## Connections`), the enrichment is aborted and a new page is created instead, linked with a "see also" connection.
- **Connections on enrichment:** set union by destination path — new connections to pages not already listed are appended; existing connection descriptions are not overwritten; backlinks updated mechanically.
- **Enrichment invariant:** enriching an existing page never deletes prose the user wrote. New material is added; existing content is not rewritten to accommodate it. A reconciliation that cannot satisfy this creates a new page and links it instead.
- **Failure is reported, never silent:** a child that errors, times out or is aborted leaves the wiki as it was, or — when pages were already written — reports exactly what was filed. A partial file that reads as a success is the failure mode this project has paid for before.
- **Single-flight:** one `wiki_file` at a time. Buddy runs one session per process and does not call tools in the background, so this is a guard rather than a scheduler. Consolidation cannot collide with it: FR-CONSOL-05 defers while the session is streaming, and a tool call is streaming.

**FR-WIKI-03 — Cross-references and backlinks**

- **Given** wiki pages reference related concepts
- **When** the agent creates or updates a page
- **Then** **relative markdown links** connect related pages (`[concept](../category/concept.md)`), each with a short description of why they connect
- **And** backlinks are maintained by code (if A links to B, B lists A as related) — the forward link already carries the description; the reverse is mechanical
- **And** `[[wikilink]]` syntax is **not** used as the storage format

**Why markdown links and not wikilinks.** Three pieces of existing machinery
already work on markdown links and none understands `[[…]]`: the viewer renders
with `marked` (a wikilink would show as unclickable text unless a custom
extension plus a title→path index were added, with a rule for duplicate
titles), `path-autolink.ts` and `local-link-handler.ts` already make relative
paths clickable in chat and navigable in the viewer, and
`consolidation-relocate.ts` already rewrites markdown links when a file moves —
a wikilink corpus would need a second implementation of the same rule, which is
exactly how NFR-SEC-16 was earned. The portability argument for wikilinks does
not survive contact either: Obsidian reads relative markdown links natively,
and what is lost is autocompletion inside Obsidian, not the ability to open the
wiki there. If wikilinks are ever wanted, they belong in the renderer, not on
disk.

**FR-WIKI-04 — Search and retrieve**

- **Given** the user asks about something that may be in their wiki
- **When** the agent looks for relevant knowledge
- **Then** `wiki_search` returns **metadata only** — path, title, summary, tags, category, connections — and never page bodies
- **And** the agent reads the matched page before answering from it, and cites the pages it used
- **And** for open questions it may instead start at `user/wiki/index.md` and navigate connections, which is what builds the accumulated context a synthesis needs
- **And** `wiki_search` is exclusively for the user's second brain (NFR-ROUTE-02) — the agent does not use it to look up its own operational knowledge, past decisions, or how to assist the user; for those it navigates `agent_brain/` through indexes and progressive disclosure
- **Rationale:** search is a navigation accelerator, not a retrieval shortcut. Returning bodies would collapse progressive disclosure into a one-shot lookup and put un-read text into the answer.

**Extraction output is validated in code, not trusted.** The source document is
untrusted content — the same rule that governs `fetch_url` — and the extraction
child's output ends up in files whose `summary` and `tags` `wiki_search` later
feeds back into the agent's context. Two cheap measures, deliberately not more:
the untrusted-content rule is stated in the child's system prompt, and the
formatter validates *shape* before writing — tags against a slug pattern,
`summary` to a single line with a length cap. The child is toolless and Buddy
has no shell, so the residual blast radius is text in the user's own knowledge
base; this is proportionate to that, and not a reason to build an isolation
apparatus around it.

**FR-WIKI-05 — Wiki health: post-write consistency + heartbeat audit**

**Revised 2026-08-11 — decoupled from consolidation.** Wiki maintenance runs on
its own cycle, independent of consolidation. The wiki and conversations grow at
different rhythms (a user may ingest 300 documents in one session but barely
chat, or vice versa). Coupling them means wiki repairs compete for the
consolidation context window, a wiki check failure can break the consolidation
cycle, and burst wiki activity waits for the next consolidation trigger instead
of being repaired immediately.

**Layer 1 — Post-write (immediate, inside `wiki_file`):**

- **Given** `wiki_file` creates or enriches a page
- **When** the write completes
- **Then** `wiki_check` runs as deterministic code: orphan pages, ghost index entries, broken links, missing backlinks, frontmatter integrity, unresolved sources, thin pages, and connectivity stats
- **And** missing backlinks and resolvable broken links are auto-repaired; index and glossary are regenerated
- **And** the wiki is always structurally consistent after every `wiki_file` call

**Layer 2 — Heartbeat audit (periodic, catches external edits):**

- **Given** the heartbeat scheduler is running
- **When** a tick fires and `wiki-state.json` → `lastHealthCheck` is set
- **Then** git is asked for commits touching `user/wiki/` since `lastHealthCheck`
- **And when** external commits are found (not authored by Buddy), `wiki_check` + `wiki_repair_links` + `wiki_regenerate` run
- **And** `lastHealthCheck` and `pagesAtLastCheck` are updated in `wiki-state.json`
- **And** repairs are committed independently of consolidation
- **And when** no external commits are found, the audit is skipped (zero cost)
- **And** wiki health evaluation is independent of consolidation — a wiki check failure does not block or affect the consolidation cycle, and vice versa

**State:** `~/.buddy/wiki-state.json` with `lastHealthCheck`, `pagesAtLastCheck`, `lastSynthesis`, `pagesAtLastSynthesis`, `synthesisCooldownDays`.

**Manual edits are ordinary input:** the user owns `user/wiki/` and can rename or edit pages outside the app. An unindexed page or a stale link is something the audit exists to find, not a corruption to complain about.

**FR-WIKI-06 — Emergent concepts are synthesized as a heartbeat task**

**Revised 2026-08-11 — decoupled from depth-3 consolidation.** Synthesis runs
on the heartbeat with its own trigger, independent of the consolidation cascade.
A user who rarely chats but ingests many documents would never trigger depth-3
(it requires multiple depth-1 and depth-2 cycles). Conversely, an active chatter
with a small wiki would run synthesis on a wiki with too little material.

- **Given** the heartbeat scheduler is running and `wiki-state.json` exists
- **When** a tick fires and wiki synthesis is evaluated
- **Then** synthesis triggers only when: (a) page count has grown by N+ since `pagesAtLastSynthesis` (threshold, e.g. 10–20), (b) `synthesisCooldownDays` have elapsed since `lastSynthesis`, (c) the session is not streaming, and (d) the budget is not near the limit
- **And when** triggered, `wiki_synthesis_candidates` scans the wiki (deterministic, no model): tags dense in pages with no page of their own, tag pairs co-occurring across several pages, page sets sharing tags but not linked
- **And** if candidates are found, a fresh synthesis session is created (fast tier, wiki-only tools, independent of consolidation lock)
- **And** the scored candidates are injected into the session prompt and the model decides which deserve a page
- **And** approved candidates are written through `wiki_create_page`, which formats, links, indexes and logs in code
- **And** a cap enforced **in code** limits how many synthesis pages one run may create (default 3)
- **And** `lastSynthesis` and `pagesAtLastSynthesis` are updated in `wiki-state.json`
- **Rationale:** synthesis needs accumulated material. The page-count threshold ensures enough pages exist before attempting abstraction. The cooldown prevents runaway synthesis on a fast-growing wiki. A cap stated only in a prompt is a cap the model may exceed without disobeying anything it understood as a rule.

**FR-WIKI-07 — The wiki is always on**

- **Given** the wiki is the default destination for user knowledge (NFR-ROUTE-01)
- **When** an instance is created
- **Then** `wiki_search` and `wiki_file` are registered on every interactive session
- **And** wiki health runs as a post-write step inside `wiki_file` and as a heartbeat audit for external edits (FR-WIKI-05)
- **And** wiki synthesis runs as a separate heartbeat task with its own cycle (FR-WIKI-06)
- **And** no setting exists to disable the wiki — it is part of how Buddy stores user knowledge, not an optional add-on
- **And** the wiki structure (`user/wiki/`) is bootstrapped on first use by `wiki_file`, not at setup (FR-WIKI-01)

**Why always-on, reversed from the original opt-in decision (2026-08-02).**
The knowledge routing redesign (NFR-ROUTE-01, 2026-08-10) made the wiki the
default destination for user knowledge. With the wiki off, "save this idea"
has no structured home — it falls back to loose files in `user/`, which is the
routing ambiguity this redesign exists to resolve. A feature that is off by
default cannot be the default destination for anything.

The original cost concern — filing spawns a child session and costs tokens —
is addressed by FR-WIKI-09: lightweight captures from conversation are
code-only (no child session, no LLM cost). The expensive path (document
ingestion with extraction) is still real, but it only triggers when the user
explicitly shares a document, not on conversational "save this" captures.
The cost is proportionate to the user's action and visible through the
progress phases (FR-WIKI-08).

**FR-WIKI-08 — Filing shows progress in plain language**

- **Given** `wiki_file` is running and may take tens of seconds
- **When** it moves between phases
- **Then** the tool activity line changes — reading the document, organizing the ideas, saving to the wiki — in the user's language, with no internal detail (no model names, no counts, never the child's raw output)
- **And** the phases reach the frontend through a callback passed into the tool, the way `show_file` already pushes to the frontend, rather than through a new SDK event path
- **And** `wiki_file` and `wiki_search` have real labels in `tool-labels.ts` and both locales — the default fallback renders "Running wiki_file", which is the tool's name leaking into the user's chat
- **And** a "this can take a moment" line appears only after the wait is already long (~15s), not at the start

**Why phases at all, for a non-technical user.** What makes a long wait feel
broken is the absence of *change*, not the absence of detail: an animation
identical for fifty seconds reads as hung, and three messages that replace each
other read as progress. The content matters less than the movement, which is
why the phases are coarse and in the user's own words. The expandable detail
already in `ToolActivity.svelte` is where anything technical belongs. Today the
frontend sees only `tool_execution_start` and `tool_execution_end`, so this
adds one event to the frontend↔worker contract (`shared/api.ts`) — worth
knowing before it is designed as if it were free.

**Testing seam (required, not optional).** `wiki_file` takes an injectable
extraction function, defaulted to the real child session, in the same way
`createMaintenanceSession` takes `openSession` — and a test that forgets to
inject must *fail*, the way `FORBID_REAL_REFLECT_SPAWN_ENV` makes a forgotten
reflect double fail rather than fork a real child. Without it, tests can only
cover the deterministic halves separately, each green, with nothing exercising
the chain — which is precisely how the Hebbian layer recorded nothing for
months (FR-HEBB-07). The seam brings its own risk, and it is paid off with one
fixture: a *recorded real extraction*, parsed in a test by the same parser
production uses, so a fake of a shape no model ever emits cannot keep the suite
green.

**FR-WIKI-09 — Lightweight capture from conversation**

- **Given** the user shares an idea, concept, or reflection in conversation and asks Buddy to save it
- **When** `wiki_file` receives `content` (inline text, not a `source_path`)
- **And** the content is short enough to be a single concept (heuristic: fits in one wiki page without extraction — e.g. under ~500 words)
- **Then** `wiki_file` creates or enriches a wiki page **directly in code**, without spawning a child extraction session
- **And** the agent provides the structured fields (title, summary, key_points, tags, category, connections) as part of its tool call — the extraction is the agent's own judgment, not a child's
- **And** reconciliation (D13) and page formatting run identically to the document-ingestion path
- **And** no LLM cost is incurred beyond the interactive session's own turn
- **Rationale:** the original design assumed all filing goes through a child session. But conversational captures — "save this idea", "remember this concept" — are typically one concept already articulated by the user. Spawning a child to extract what the agent has already understood is redundant cost and latency. The child session is reserved for documents that need multi-concept extraction (PDFs, articles, long notes).
- **The boundary is the agent's judgment, not a word count.** The heuristic guides, but the agent decides: if the user shares a long brainstorming dump with multiple distinct ideas, the agent should use the document-ingestion path (with child session) even if the content came inline. The test is "does this need extraction into multiple concepts?" — not "how many words is it?"

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
| FR-NET-03 | Untrusted content framing | 2 ✓ |

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

### 3.23 OpenAI-Compatible Providers (FR-PROVIDER)

| ID | Requirement | Phase |
|----|-------------|-------|
| FR-PROVIDER-01 | Configure and use an OpenAI-compatible endpoint end to end | deferred |
| FR-PROVIDER-02 | Model selection for an endpoint with no catalog | deferred |
| FR-PROVIDER-03 | Legible failure when the endpoint is unreachable | deferred |

**Deferred on evidence, 2026-07-29.** Two local models were evaluated end to end
(gemma-4 12B and 26B via oMLX). Conversation and retrieval were close to a
commercial model; file editing was not, and the disqualifying behaviour is that
both repeatedly stated a file had been written when no tool call had been made.
For an assistant whose value is remembering, a silent false "I wrote that down"
is the worst available failure.

The plumbing question is answered and documented below — it is no longer the
blocker. The question to settle before revisiting is whether any local model
completes a depth-1 consolidation without corrupting the brain. See decision 6
in `docs/app-design-principles.md`.

**Aug 2026 eval update.** Three interactive sessions + six consolidation runs
with harness fixes shipped since Jul 29. Key findings:

- **Qwen 27B (4-bit):** viable for chat + reflect (B+ reflect quality, 11.4%
  edit failure rate). Consolidation not yet tested with this model.
- **Gemma 12B (8-bit):** viable for chat only (reflect F, 50% edit failure
  rate). Consolidation with guards ON (C6) produced zero corruption.
- **Phantom writes root cause found:** not a model capability limit — context
  saturation past ~40k tokens causes tool-calling loss. Primary fix is setting
  `contextWindow` correctly in `models.json` so compaction fires before the
  quality cliff. See FR-PROVIDER-01 (mandatory `contextWindow`) below.
- **Harness guards validated:** heading guard (FR-GUARD-01), Hebbian guard in
  maintenance (FR-HEBB-08), per-depth sessions (FR-CONSOL-16), reflect
  sanitizer (#12) — all shipped and validated. C6 vs C4 showed guards
  eliminate metadata corruption and template destruction.
- **Remaining harness gaps (Tier 1.1):** concepts index injection at
  consolidation depth 3 (not yet shipped).

The deferral rationale from Jul 29 is partially resolved: the worst failures
(phantom writes, template destruction, reflect garbage) now have shipped
fixes. The remaining question is whether Qwen 27B passes depth-1
consolidation — which gates the feature on model tiering (strong model for
reflect/consolidation, fast model for chat).

**Why this is a new FR rather than a bug fix.** The feature was half-built and
looked finished from every angle we normally check: the wizard offered it, the
key validated against the real endpoint, the credential reached `auth.json`,
and a BDD scenario asserted all of it and passed. What no layer did was keep the
`baseUrl`. Closing that gap needs persistence, model resolution and a UI path
that do not exist yet, so it is scoped as a feature and not a patch.

**FR-PROVIDER-01 — Configure and use an OpenAI-compatible endpoint**

- **Given** the user wants to use a model that speaks the OpenAI API — Ollama, LM Studio, llama.cpp, vLLM, oMLX, or a hosted compatible service
- **When** they configure it with a base URL and (optionally) an API key
- **Then** the base URL is persisted, not merely used for validation, and survives a restart
- **And** the model runtime resolves requests to that endpoint — verified by a test that asserts an actual request reaches it, not by asserting the value was written
- **And** the destination is validated first (NFR-SEC-18), which already allows loopback and LAN precisely for this case
- **And** the entry point exists in both the setup wizard and Settings → Add provider, which must not disagree about which providers exist
- **And** a keyless endpoint (Ollama, oMLX default) does not require an API key — the submit button is enabled without one, and a placeholder `apiKey` is written to `models.json` (not `auth.json`)
- **And** `contextWindow` is set per model — either auto-detected from `/models` response metadata (when available), entered by the user, or defaulted to a conservative value (32768). Without a correct `contextWindow`, compaction fires too late or never, causing context saturation and phantom writes (#26)
- **And** after writing `models.json`, the runtime is refreshed — `reloadConfig()` on Pi SDK ≤0.80.x, `refresh()` on ≥0.82.x. Feature-detect which is available
- **And** `runtime.getError()` is checked after configuration and surfaced to the user if the provider was dropped due to malformed config
- **And** `custom` is added to `ADD_PROVIDER_CANDIDATES` in settings-controller and to `WIZARD_PI_PROVIDERS` in auth-status, so the provider is visible in both flows
- **And** `custom` is included in `buildAuthStatus()` so credential state is tracked like cloud providers
- **And** `compat` flags are pre-populated with safe defaults for local servers (`supportsDeveloperRole: false`, `supportsReasoningEffort: false`, `supportsUsageInStreaming: false`, `supportsStrictMode: false`, `supportsStore: false`, `maxTokensField: "max_tokens"`). The user should not have to know about `supportsDeveloperRole` to get a working setup — this was a hard-won lesson: without it, the model ignores the system prompt entirely

**Persistence — resolved 2026-07-28 by reading the Pi source and probing the
bundled v0.80.10 SDK.** `baseUrl` lives in a `models.json`, under
`providers.<id>.baseUrl`. Crucially, **that file does not have to be inside
`agentDir`**: `modelsPath` is a first-class option of `ModelRuntime.create()`
(`model-runtime.d.ts:7`, present in the bundled version), so Buddy writes
`~/.buddy/models.json` — a sibling of `auth.json`, outside the deliberately
empty `~/.buddy/agent/`. The conflict with NFR-SEC-19 disappears rather than
needing to be managed.

```jsonc
// ~/.buddy/models.json
{
  "providers": {
    "ollama-local": {                                 // never a built-in id
      "name": "Ollama (local)",
      "baseUrl": "http://127.0.0.1:11434/v1",         // the /v1 is required
      "api": "openai-completions",
      "apiKey": "ollama",                             // placeholder; see below
      "compat": {                                      // see compat flags above
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens",
        "supportsStrictMode": false,
        "supportsStore": false
      },
      "models": [{
        "id": "qwen2.5:7b",
        "contextWindow": 32768,                        // REQUIRED — default is 128k
        "maxTokens": 8192
      }]
    }
  }
}
```

**Compatibility flags — critical for local model servers.** Most
OpenAI-compatible servers (Ollama, vLLM, SGLang, oMLX, LM Studio) do not
implement the full OpenAI API. Without the right `compat` flags in
`models.json`, requests fail silently or the model ignores the system prompt.
Reference: Pi docs `packages/coding-agent/docs/models.md` → OpenAI
Compatibility section.

Minimum `compat` for typical local servers (Ollama, oMLX):

```jsonc
"compat": {
  "supportsDeveloperRole": false,     // CRITICAL — without this, system prompt
                                      // goes as "developer" role, which local
                                      // servers don't understand. The model
                                      // ignores AGENTS.md and behaves erratically.
  "supportsReasoningEffort": false,   // most local servers don't support this
  "supportsUsageInStreaming": false,   // many don't include usage in stream chunks
  "maxTokensField": "max_tokens",     // some use old field name
  "supportsStrictMode": false,        // no strict JSON-schema tool definitions
  "supportsStore": false              // no store support
}
```

Additional `compat` flags to consider per server:

| Flag | When to set | Notes |
|------|-------------|-------|
| `supportsFinishReason: false` | Server omits `finish_reason` in streamed responses | Pi infers stop/toolUse from stream end |
| `thinkingFormat: "qwen"` | Qwen models with thinking via Ollama | Uses top-level `enable_thinking` |
| `thinkingFormat: "qwen-chat-template"` | Qwen models via vLLM/local servers | Uses `chat_template_kwargs.enable_thinking` |
| `requiresThinkingAsText: true` | Server can't handle thinking blocks | Converts to plain text |

`compat` can be set at provider level (applies to all models) or per model
(overrides provider). Provider-level is simpler for single-server setups.

**`contextWindow` defaults to 128000 when omitted** (per Pi model config
docs). For a 12B model running locally with an effective quality window of
~32k, this means compaction never fires and context saturation causes phantom
writes. **Always set `contextWindow` explicitly for local models.**

Constraints established, each verified against the bundled SDK rather than the
docs (the docs disagree in three places and the code was right each time):

- **A keyless endpoint still needs a credential.** With none, the model loads
  but `getAvailable()` filters the provider out and returns `[]` — a silent
  empty dropdown. The fix is a literal placeholder `apiKey` in `models.json`,
  **not** a fabricated entry in `auth.json`: Buddy's credential store must not
  contain invented secrets. A real key, when the user has one, goes to
  `auth.json` as today and takes precedence.
- **`getAvailable()` makes no network request** for a custom provider; it is
  pure local config. An unreachable endpoint is therefore invisible to it, which
  is precisely why FR-PROVIDER-03 needs Buddy's own probe.
- **The provider id must not collide with a built-in.** Reusing `openai` merges
  instead of replacing and re-attaches the remote-catalog network refresh.
- **Omitted `cost` defaults to zero via `models.json`** (so local models
  accumulate no spend — arguably right, but it means they never approach the
  monthly cap). The same omission via the `registerProvider()` API instead
  **throws** in `calculateCost`. This is one reason to prefer the file.
- **`registerProvider()` exists and is public**, but fills no defaults and does
  not survive a restart. Use `models.json` as the source of truth.
- **Reload is version-dependent.** On the bundled 0.80.10, `refresh()` does not
  re-read `models.json`; `reloadConfig()` must be called after writing. That
  method is removed in 0.82.x, where `refresh()` reloads. Feature-detect.
- **`runtime.getError()` must be surfaced.** A malformed provider is dropped
  silently and never appears in `getProviders()`.

**Prerequisite — NFR-SEC-19 is not fully satisfied (found during this
research).** `createBuddyModelRuntime()` calls `ModelRuntime.create({ authPath })`
without `modelsPath`, so the SDK falls back to
`join(getAgentDir(), "models.json")` — the **Pi CLI's** `~/.pi/agent/models.json`.
Verified empirically on the maintainer's machine: Buddy reports the user's
personal `ollama` and `omlx` providers among its own. H6b fixed the `agentDir`
passed to `createAgentSession` and missed this second, independent path to the
same directory. `modelsStorePath` defaults to `dirname(modelsPath)` and so
points into `~/.pi/agent/` too, making writes possible there as well (not
observed in probing, but the store is constructed against that path). Passing
`modelsPath` explicitly closes the leak and is the same change FR-PROVIDER-01
needs anyway.

**Evaluating a local model before building any of this (2026-07-28)**

The plumbing can be exercised by hand today, with no code changes, on v0.1.7 or
later. Earlier versions resolve `modelsPath` into `~/.pi/agent/`, so the file
would land in the user's Pi CLI configuration instead (NFR-SEC-19).

Verified end to end — `getProviders`, `getAvailable`, `listModelsForProvider`
and `resolveSessionModel` all resolve the model:

1. Write `~/.buddy/models.json`. **The provider id must be literally `custom`**,
   because `toPiProviderId("custom")` returns `"custom"` and that is what makes
   Buddy's existing provider mapping line up.

   ```json
   {"providers":{"custom":{
     "name":"Local","baseUrl":"http://127.0.0.1:8000/v1","api":"openai-completions",
     "apiKey":"local",
     "compat":{"supportsDeveloperRole":false,"supportsReasoningEffort":false,
               "supportsUsageInStreaming":false,"maxTokensField":"max_tokens",
               "supportsStrictMode":false,"supportsStore":false},
     "models":[{"id":"MODEL","name":"Local","contextWindow":32768,"maxTokens":8192}]}}}
   ```

2. Set `<rootDir>/.pi/settings.json` to `{"defaultProvider":"custom",
   "defaultModel":"MODEL"}` and the matching `provider`/`model` in
   `~/.buddy/config.json`.
3. Start the app and **do not open Settings** — changing the model there calls
   `writePiSettings` and overwrites step 2. This is the fragile part, and it is
   the manual procedure's only real trap.

**What the run has to answer is not "does it reply".** Decision 6 in
`docs/app-design-principles.md` gates local models on whether they *reliably
follow buddy's memory procedures*, so the evaluation is:

| Check | What it reveals |
|---|---|
| End a session, read `logs/YYYY-MM-DD.md` | Does reflect produce the structured block, or prose? |
| Force a depth-1 consolidation | Is `summary`/`created` frontmatter preserved (NFR-FORMAT-01)? |
| Mention a task and a decision | Is routing to `user/` vs `agent_brain/` correct? |
| Ask for something needing a file | Are the tools used, or is bash hallucinated? |

**The consolidation check is the one that decides.** The others fail loudly and
recoverably; a bad consolidation does not fail at all — it corrupts, and
malformed frontmatter written once a week is discovered a month later. It is
also the longest prompt with the most format constraints, so it is where a
smaller model breaks first.

Use a large local model (27B+). A 7B will fail these and the result says nothing
about the approach.

**Eval results (Aug 2026) — this manual procedure was used for all runs.**

| Model | Chat | Reflect | Consolidation | Edit failure rate |
|-------|------|---------|---------------|-------------------|
| Qwen3.5-27B-4bit | A- tools, B+ coherence | B+ (structured, accurate) | Not yet tested | 11.4% |
| gemma-4-12B-8bit | A tools, A- coherence | F (raw chat dump, tool leaks) | With guards: zero corruption (C6) | ~50% |

**Critical `contextWindow` finding:** the manual procedure above sets
`contextWindow: 32768` in `models.json`. Without it, Pi reads the model's
native window from the provider (gemma reports 128k) and compaction never
fires — the model hits its practical quality cliff (~40k) silently. This is
the root cause of phantom writes (S5: model claimed 6 file creations, issued
0 tool calls). **FR-PROVIDER-01 must ensure `contextWindow` is set correctly
at configuration time** — it is not optional metadata.

Further context on local-model evaluation methodology and findings:
`docs/app-design-principles.md` (decision 6) and the table above.

**FR-PROVIDER-02 — Model selection without a catalog**

- **Given** a configured OpenAI-compatible endpoint
- **When** the user picks a model
- **Then** models are listed live from the endpoint when it answers `/models`, since most compatible servers do
- **And** a free-form model id is accepted when it does not — `ModelStep.svelte` already implements this input and it is kept for this purpose
- **And** the provider appears in the Settings provider dropdown. **Fix the dropdown first:** it is derived from the model list, so a provider with no models has no `<option>`, nothing is `selected`, and the control displays a provider the user is not using
- **And** when `/models` returns model metadata with `context_length` or equivalent, it is used as the default `contextWindow` for that model — saving the user from having to know their model's context size. **If `/models` does not return context size, the setup flow must ask the user explicitly** — the Pi SDK default of 128k is dangerous for local models (causes phantom writes on models with effective quality windows of 32k–40k)
- **And** for reasoning-capable Qwen models, `compat.thinkingFormat` is set automatically: `"qwen"` for Ollama (which uses top-level `enable_thinking`), `"qwen-chat-template"` for vLLM/local servers (which use `chat_template_kwargs.enable_thinking`). Other reasoning models (DeepSeek, etc.) may need different `thinkingFormat` values — the setup flow should handle this per model family when `reasoning: true` is selected
- **And** `fastModelForProvider("custom")` resolves to a usable model (the configured one, or the first available) instead of `undefined` — so checkpoint reflect does not silently fail on local providers

**FR-PROVIDER-03 — Legible failure when the endpoint is unreachable**

- **Given** the user configures `http://localhost:11434/v1` and the server is not running
- **When** the key is validated
- **Then** the message says the endpoint could not be reached and names it — the current behaviour surfaces Node's `"fetch failed"`, which tells the user nothing
- **And** the same applies to a refused connection, a DNS failure and a timeout; NFR-REL-09 covered only the timeout, and a stopped local server is the common case
- **And** an endpoint that stops responding after setup degrades visibly rather than appearing to hang
- **And** when the endpoint goes down mid-session, the chat shows a recoverable error (not a silent hang) with guidance: "Check that your local model server is running at [url]"
- **And** the error is distinguishable from an API key rejection — "connection refused" vs "401 unauthorized" are different user actions (start the server vs fix the key)

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
| NFR-SEC-16 | Containment has one worker-side authority, `backends/containment.ts` (`isContained`, `containedRelPath`), and every enforcement point calls it. `shared/viewable-path.ts` remains separate because it must be browser-safe, and its verdict is explicitly presentational: it decides the *shape* of a link, never whether bytes may be read. Symlink resolution (NFR-SEC-15) lives in the authority and nowhere else. **Why this is not cosmetic:** the rule was implemented four times, and the fourth was wrong — `relocate_brain_file` tested `startsWith("agent_brain/")` on the raw argument, which `agent_brain/../.pi/settings.json` satisfies, letting the consolidation session `git mv` the model configuration that NFR-SEC-06 forbids the agent to write. A containment rule written four times is a containment rule that disagrees with itself. |
| NFR-SEC-17 | Files and directories under `~/.buddy/` are created with restrictive permissions from the outset, not widened and then narrowed. `auth.json` is created `0600` rather than written at the umask default and `chmod`-ed afterwards, and the directory itself is not world-readable — it also holds `config.json`, `usage.json` and `allowed-paths.json`, the last of which reveals which directories the user has granted access to. |
| NFR-SEC-18 | A custom provider's `baseUrl` is validated before an API key is sent to it. The URL must parse, must be `http://` or `https://`, and must not be — nor resolve to — a cloud metadata endpoint (`169.254.0.0/16`, `metadata.google.internal` and friends), the unspecified address, multicast or reserved space. **Amended during H8.** The original text said "the same destination rules as `fetch_url` (NFR-SEC-12)", which refuses loopback and private addresses. That is right for `fetch_url`, whose URL is chosen by the agent under the influence of pages it has already fetched, and wrong here: this URL is typed by the user into a field that exists so they can point Buddy at Ollama, LM Studio or llama.cpp, and `http://localhost:11434/v1` is the most common correct value. Applying the SSRF rules verbatim refused the only reason the custom provider exists — the BDD scenario for it failed on exactly that string. Loopback and LAN addresses are therefore allowed; what stays refused is what no local model server is ever behind and where an `Authorization` header does real damage. |
| NFR-SEC-19 | Buddy sessions use Buddy's own agent directory (`~/.buddy/agent/`), never the Pi CLI's `~/.pi/agent/`. No production code calls the SDK's `getAgentDir()`, **and no production code lets the SDK call it on Buddy's behalf** — every SDK entry point that defaults a path to `getAgentDir()` must be passed an explicit Buddy path. **Amended and closed 2026-07-28.** H6b satisfied the first clause and left two routes open, each found by probing rather than by reading: `ModelRuntime.create` defaulted `modelsPath` to `join(getAgentDir(), "models.json")` — so Buddy loaded the user's Pi CLI provider definitions, and cached its own catalogue into `~/.pi/agent/models-store.json` — and `createAgentSession` was called without `agentDir`, so its `SettingsManager` read the user's `~/.pi/agent/settings.json` (provider, model, thinking level, theme). The requirement had been written as *which directory do we pass*; it needed to be *which directories can the SDK still reach on its own*. Now: `modelsPath`/`modelsStorePath` resolve under `~/.buddy/`, all three `createAgentSession` call sites pass `agentDir`, and two guards hold the line — a behavioural test that points `PI_CODING_AGENT_DIR` at a decoy `models.json` and asserts Buddy never loads it, and a source check that fails when a `createAgentSession` call omits `agentDir` (with a companion assertion that it is inspecting all three sites, so deleting them cannot make it vacuously pass). **Amended 2026-08-08.** `SessionManager.create(cwd)` derives its session directory from `getAgentDir()` when the second argument is omitted, placing every Buddy conversation JSONL in `~/.pi/agent/sessions/`. The same unnamed-default pattern applied here and was not covered by the existing guard. Now: all `SessionManager.create` calls pass an explicit `sessionDir` resolving to `<rootDir>/.buddy/sessions/`, and the source guard fails when a call omits it. |
| NFR-SEC-20 | Adding an SDK call that accepts a path is a security decision. Any option whose default resolves through `getAgentDir()` must be passed explicitly, and the omission must fail a test rather than be caught in review. **Why this is its own requirement:** NFR-SEC-19 names a directory, and a reader satisfies it by checking the calls they know about. The two leaks above were in calls nobody thought of as agent-directory calls — one creates a model runtime, the other a session. The property is not "we pass the right agentDir" but "no SDK default reaches the user's Pi CLI configuration". **Extends NFR-SEC-07 from credentials to configuration.** `agentDir` governs far more than auth: skills, `settings.json`, `tools/`, `extensions/`, `prompts/`, the project trust store and `models.json`. Passing the global directory meant only credentials were isolated and the user's entire Pi CLI setup leaked into every Buddy session. |

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
| NFR-REL-09 | Network calls made on a user-facing path are bounded by a timeout and report failure in plain language. Applies to API-key validation during setup, to model listing, and to the model-catalogue refresh at startup — a host that accepts the connection and then goes silent is the case that has cost the most, because there is no error to fail fast on. Bounds are Buddy's to choose, not a dependency's default. |
| NFR-REL-10 | Reconnecting to the worker releases the previous connection before opening a new one. The transport is closed and the crash listener is removed, so exactly one channel is ever delivering worker output. **Why:** `jsRuntimeTransport` subscribes to the global `js-process-stdout` Tauri event and filters by process name; the unsubscribe only runs inside `transport.close()`. Discarding the transport left the listener alive, and because every worker is spawned under the same name, the next channel did not replace the old one — it joined it. After one crash and restart, every worker→frontend RPC arrived twice and the chat rendered each streamed delta twice ("SoySoy ** BuddyBuddy**"). The doubling scaled with restart count, and no test caught it because `FakeSession` never crosses the kkrpc boundary. |

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
| NFR-ACC-04 | Every CSS custom property a component references is defined in `src/app.css`, and no reference carries a literal colour as fallback. **Why this is not cosmetic:** NFR-ACC-01 is stated as a promise about `prefers-color-scheme`, but `var(--name, #hex)` keeps the component rendering when `--name` does not exist — with the hex, in both themes, silently. The "session preparing" banner (FR-CHAT-13) referenced `--surface-2` and `--text`, neither of which was ever defined, so it drew itself dark-on-dark in light mode from the day it shipped. Nothing disobeyed a rule: the typo *is* the fallback syntax working as designed. A fallback on a token that **is** defined is dead in the other direction — it can never be reached, and it lies about which value applies. Both are checked by `tests/unit/design-tokens.test.ts`. |

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
| NFR-CONFIG-05 | One resolver for the global config directory, and **one name for it**: `globalConfigDir()`, with `globalConfigPath()` for the config file. Precedence is `BUDDY_CONFIG_DIR`, then the directory of `BUDDY_CONFIG_PATH` (or its legacy alias), then `~/.buddy`. This matters because the resolvers are consulted by different processes: the worker resolved `usage.json` one way while the reflect child, a separate process (FR-REFLECT-06), resolved it the other, so a run could bill against a file nobody was reading and the budget cap would undercount. **Amended 2026-07-29.** The original fix left `defaultConfigDir()`/`defaultConfigPath()` as one-line delegating aliases and this requirement said so. Two names for one answer is the condition that produced the divergence in the first place — the second name is where a future "small" change lands, and a test can only pin the agreement of the names it knows about. The aliases are removed; there is nothing left to delegate. |
| NFR-CONFIG-06 | The buddy directory layout is named in `shared/brain-paths.ts` (relative paths, browser-safe) and built in `backends/brain-paths.ts` (the only place a `rootDir` is joined to a brain location). Call sites ask for `soulPath(rootDir)`, not `join(rootDir, "agent_brain", "identity", "SOUL.md")`, and `shared/defaults.ts` derives `CORE_BRAIN_FILES`, `FRONTMATTER_EXEMPT_FILES`, `PROTECTED_DIRS` and `VIEWABLE_DIRS` from the same table instead of respelling them. **Why:** the layout was written out in seventeen files *and* declared in `defaults.ts` — one fact stated twice, in two formats. The literals had the worse failure mode: a mistyped `agent_brain/identiy/USER.md` makes `readIfExists` return undefined, the system prompt is assembled without the user's profile, and nothing errors, logs or fails a test. Naming it makes that a compile error. **This is not a containment authority.** Whether a path is genuinely *inside* the brain — resolving `..`, following symlinks — remains `backends/containment.ts` and nowhere else (NFR-SEC-16). `dirPrefix()` describes spelling, not location, and says so. |

### 4.9 Boot Refresh and Migration (NFR-MIGRATE)

| ID | Requirement |
|----|-------------|
| NFR-MIGRATE-01..05 | *Superseded* — integer `~/.buddy/version` schema migrations removed. Single semver mechanism (NFR-MIGRATE-06) handles all boot-time updates. |
| NFR-MIGRATE-06 | On boot, compare app semver (from `package.json` / Tauri version) with `last_app_version` in `~/.buddy/config.json`. If `config.json` is absent, `last_app_version` is absent, or semver differs: deploy all bundled global content to `~/.buddy/` (overwrite `prompts/` and `docs/` from embedded/bundled sources), then set `last_app_version` to the current semver. Runs silently before any session starts. No separate version file. |
| NFR-MIGRATE-07 | The app version has **one source**, `package.json`, and the four places that restate it — `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `backends/embedded-assets.generated.ts` — are written by `npm run version:set <semver>`, never by hand. A test fails when they disagree. **Why:** NFR-MIGRATE-06 makes the version a value the code acts on, and each copy is read by a different consumer — Cargo's is what the About dialog shows via `env!("CARGO_PKG_VERSION")`, Tauri's is what the published release is named, the snapshot's is what the compiled sidecar reports. The v0.1.8 bump updated three of the four and nobody noticed for a release, because the one it missed is regenerated at build time and so was only wrong in the repository. Bumping by hand is five edits with no failure mode for forgetting one; that is the definition of a rule that needs enforcement rather than discipline. **Amended at the v0.1.9 bump:** the requirement first said *three* places and the script wrote three. `Cargo.lock` records the crate's own version, is committed, and cargo only rewrites it on the next build — which is not when the tag is cut, so v0.1.8 was tagged with a lock still naming 0.1.7. Writing the rule down did not make it complete; running it against a real release did. **Release notes are part of the same act:** `docs/releases/<tag>.md` is written before the tag, `release.yml` reads it and refuses to publish without it, and the same test fails when the file for the current version is missing. Every release through v0.1.9 was published with the workflow's placeholder body and edited by hand afterwards, which is why v0.1.0 still carries a stray "Download the installer" line. |

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
| NFR-MAINT-02 | Prune forked session files in `.buddy/reflect-sessions/` and live session files in `.buddy/sessions/` on the same housekeeping pass, keeping a bounded recent window (7 days). Nothing pruned them before: one fork is created per session and per checkpoint, each holding the **full conversation transcript** in plain text, and they accumulated indefinitely (verified on a live instance: 5 files, 168 KB, largest 107 KB, after two days of use). Live sessions had the same problem under `~/.pi/agent/sessions/` until NFR-SEC-19 (2026-08-08) moved them to `.buddy/sessions/`. NFR-REL-02 justifies keeping recent forks for manual recovery; it does not justify keeping every conversation forever. The reasoning of NFR-MAINT-01 applies with more force here, because the content is the conversation itself rather than an event log. |

### 4.11 Testing Discipline (NFR-TEST)

| ID | Requirement |
|----|-------------|
| NFR-TEST-01 | Every FR with an input surface — a path, a URL, file content, or LLM output — carries at least one Gherkin scenario driving hostile or malformed input, not only the happy path. A feature is not `done` until that scenario exists and passes. |
| NFR-TEST-02 | The test suites never start a real background process, and reaching the code that would is a **loud failure**, not a silent one. `spawnReflectChild` refuses and throws when `BUDDY_FORBID_REAL_REFLECT_SPAWN` is set, which both runners set for every run. **Why:** the BDD suite forked a real detached `reflect-child` on every run (`session-persistence.steps.ts` built a `SessionLifecycle` without injecting `spawnReflect`, so the production default applied). It was harmless only by accident — the scenario's session file did not exist, so `runReflect` returned at its first guard, *before* `createBuddyModelRuntime()`. Point that scenario at a session file that does exist, which is the natural next step for anyone deepening reflect coverage, and the same path reads the developer's real `~/.buddy/auth.json` and makes a billed LLM call from the test suite. The defect is not the two call sites, it is that the dangerous path was the default and the test double was opt-in. |

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

### 4.12 Knowledge Routing (NFR-ROUTE)

| ID | Requirement |
|----|-------------|
| NFR-ROUTE-01 | The agent routes captured information to one of three destinations based on **ownership**, not topic. The rule is declared in `agents-base.md` (FR-PROMPT-03) and produces deterministic behavior for the common cases: user knowledge → `user/wiki/`, actionable items → `user/inbox.md` / `user/projects/`, agent self-improvement → `agent_brain/`. The agent does not ask "where should I save this?" unless the input is genuinely ambiguous (e.g. a document that contains both tasks and reference knowledge). |
| NFR-ROUTE-02 | The routing rule applies symmetrically to **retrieval**. `wiki_search` is for the user's second brain; the agent does not use it to look up its own operational knowledge. When the user asks "what do I know about X?", the agent searches the wiki. When the agent needs context about how to assist this user (preferences, past decisions, project history), it navigates `agent_brain/` through indexes and progressive disclosure. When the user asks about past conversations, the agent reads logs. |

**The test is ownership, not topic.** A concept about "complex systems" could
live in either space: if the agent learned it to understand the user's writing
→ `agent_brain/concepts/`. If the user shared it as knowledge they want to keep
→ `user/wiki/`. The distinction is *who needs it and why*.

**Why this is an NFR, not an FR.** Routing is not a feature the user sees — it
is a behavioral property that crosses every feature involving capture or
retrieval: reflect (FR-REFLECT), consolidation (FR-CONSOL), brain template
(FR-BRAIN), wiki (FR-WIKI), and the prompt that governs all of them
(FR-PROMPT). Making it an NFR lets the FRs reference it without each one
restating the rule.

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
