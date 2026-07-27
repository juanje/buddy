# Implementation Progress

Track of implemented features. Updated ONLY when all acceptance criteria pass.

## Phase 0 — Architecture PoC

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-02 | User input with send | done | 1a13fdd |
| FR-CHAT-01 | Streaming message display | done | eca5ce2 |
| FR-CHAT-03 | Abort generation | done | f858146 |
| FR-CHAT-07 | Auto-scroll with manual override | done | 2c799d8 |

**Phase 0 complete:** YES — all 4 features green (14/14 BDD scenarios, 8 unit tests).

**Native stack validated on macOS (b036774):** worker spawn from the frontend,
real Pi streaming end-to-end (message_update deltas render in the transcript),
and mid-stream abort with partial text kept. Two fixes were needed: spawn config
(NODE_OPTIONS tsx + absolute cwd) and Pi's configureHttpDispatcher() in the
worker (Node >= 26 fetch/undici mismatch left SSE gzip undecompressed → empty
responses). Dev-only diagnostics bridge added in c2442ff (`/__ab_log`,
`/__ab_cmd` via the Vite server).

## Phase 1 — MVP

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-BRAIN-01 | AGENTS.md behavioral rules template | done | 2e79ede, 72edf52 |
| FR-BRAIN-02 | SOUL.md character definition | done | 2e79ede, 152ebc4 |
| FR-BRAIN-03 | USER.md placeholder template | done | 2e79ede |
| FR-SETUP-01 | First-run detection → wizard | done | 344a0d7 |
| FR-SETUP-02 | Language selection | done | rework-sprint |
| FR-SETUP-03 | Welcome screen | done | rework-sprint |
| FR-SETUP-04 | Location picker | done | e3ce95e |
| FR-SETUP-05 | Provider authentication (OAuth primary) | done | da071a6 |
| FR-SETUP-06 | Model selection | done | ada10c4 |
| FR-SETUP-07 | Personalization form (name + about) | done | rework-sprint |
| FR-SETUP-08 | Deterministic buddy setup (populate USER.md from form) | done | rework-sprint |
| FR-SETUP-09 | First conversation warm handoff | done | rework-sprint |
| FR-SETUP-10 | Import existing instance | done | 7733b0e |
| FR-PROMPT-01 | System prompt assembly | done | d7a3c12 |
| FR-PROMPT-02 | Session-start enrichment | done | d7a3c12 |
| FR-PERM-01 | Zone 1: buddy home silent allow | done | d3e57f3 |
| FR-PERM-02 | SOUL.md write confirmation (USER.md silent) | done | rework-sprint |
| FR-PERM-03 | Zone 3: outside access prompt | done | d3e57f3 |
| FR-PERM-04 | Hardcoded denylist | done | d3e57f3 |
| FR-PERM-06 | Zone 2: user-designated paths | done | b08a00b |
| FR-PERM-07 | Permission prompt in chat | done | 1031c99 |
| FR-SESSION-01 | Fresh session on every launch | done | rework-sprint |
| FR-SESSION-02 | New session | N/A (every launch is fresh) | |
| FR-SESSION-03 | Session end on app close | done | 842635e, 6d58175 |
| FR-REFLECT-01 | Factual skeleton (crash fallback) | done | 842635e |
| FR-REFLECT-02 | Forked reflect on session end (background child) | done | 6d58175 |
| FR-REFLECT-03 | Checkpoint mid-session reflect (base framework) | done | 6d58175 |
| FR-DEFERRED-01 | Surface deferred on start | done | d7a3c12 |
| FR-INGEST-01 | Drag & drop file ingest | done | 656634b |
| FR-INGEST-02 | Attach button | done | 656634b |
| FR-INGEST-03 | Dropped file implicit permission | done | 656634b |
| FR-INGEST-04 | Supported formats | done | 656634b |
| FR-INGEST-05 | Image attachments (vision) | done | 656634b |
| FR-INGEST-06 | PDF attachments (local text extraction) | done | 03f6b7f |
| FR-SHELL-01 | App header bar with session controls | removed | — |
| FR-SHELL-02 | Explicit end-session button | removed | — |
| FR-SHELL-03 | About / app info (native macOS menu) | done | 48bc7bc |
| FR-GIT-01 | Auto-commit after writes | done | 842635e |
| FR-GIT-02 | Git invisible to user | done | 842635e |
| FR-GIT-03 | Index rebuild on session end | done | 842635e |
| NFR-I18N | Locale module (es + en) | done | rework-sprint |
| NFR-AUTH-ISO | Auth isolation (buddy ≠ Pi CLI) | done | (this commit) |

## Phase 3 — Chat polish (early)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-04 | Markdown rendering in assistant messages | done | 19eef12 |
| FR-CHAT-05 | Thinking block display (transient indicator) | done | 5e89120 |
| FR-CHAT-06 | Tool call display (expandable activity block) | done | 5e89120 |
| FR-CHAT-08 | Input textarea resets height after send | done | 491b6e9 |
| FR-SETTINGS-02 | Settings UI (language + read-only config) | done | 6ea7f89 |
| FR-SETTINGS-03 | Cross-provider model switching + inline provider auth | done | cece2f0 |
| FR-SETTINGS-04 | Language switching from settings | done | 6ea7f89 |
| FR-SETTINGS-05 | Settings access from UI (gear icon + menu) | done | 2e051c5 |

**Phase 1 complete:** YES — all Phase 1 FRs implemented and passing (182 unit tests, 104 BDD scenarios).

## Phase 2 — Implemented early

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-HEBB-01 | Intercept read tool calls | done | b977e60 |
| FR-HEBB-02 | Frontmatter update | done | b977e60 |
| FR-HEBB-03 | Exclusions | done | b977e60 |
| FR-HEBB-04 | Lazy commit | done | b977e60 |
| FR-REFLECT-03 | Checkpoint mid-session reflect | done | fbee7f9 |
| FR-REFLECT-04 | Log output sanitizer | done | 7c5bd69 |
| FR-DEFERRED-02 | Heartbeat periodic deferred check | done | 7b53829 |
| FR-CONSOL-01 | Usage-based consolidation triggers | done | 7b53829 |
| FR-CONSOL-02 | Cascade ordering | done | 7b53829 |
| FR-CONSOL-03 | Separate maintenance session | done | 7b53829 |
| FR-CONSOL-04 | Lock management | done | 7b53829 |
| FR-CONSOL-05 | Idle-aware scheduling | done | 7b53829 |
| FR-CONSOL-06 | Run journal | done | 7b53829 |
| FR-CONSOL-07 | Consolidation relocate tool for brain file grouping | done | (see E16) |
| FR-COST-02 | Usage panel in Settings | done | (see E15) |
| FR-COST-03 | Budget warning + hard limit | done | (see E15) |

## Post-MVP — Fable review fixes (2026-07-21)

| Finding | Description | Commit |
|---------|-------------|--------|
| A | NFR-SEC-06: block writes to `.pi/settings.json` | b167d04 |
| B | FR-PERM-04: denylist wins over sessionAllowedPaths | b167d04 |
| C | FR-SETUP-05: fix stale auth path in spec | 81a5234 |
| E | AGENTS.md: only SOUL.md needs confirmation | 81a5234 |
| F | Remove redundant afterToolCall Hebbian path | 7987112 |
| G | Wire lifecycle before warm handoff | 7987112 |
| I | Delete dead AppHeader/AboutPanel components | 0c0ce59 |
| J | Remove stray `.ab-app.bak/config.json` | 0c0ce59 |
| K | Move `model-catalog.ts` to `shared/` | 0c0ce59 |
| L | Fix `relPath` prefix match without separator | 0c0ce59 |
| D | Clarify Hebbian is automatic inside app | 0f178ad |

## Phase 2 — Global config + wizard hardening

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-PROMPT-03 | Global base prompt (agents-base.md from ~/.buddy/prompts/) | done | 7a4f405 |
| NFR-PORT-05 | Core prompts in ~/.buddy/ (not rootDir) | done | 7a4f405 |
| NFR-CONFIG-04 | Core prompts and docs populated via boot refresh | done | (unify) |
| NFR-MIGRATE-01..05 | *Superseded* — integer schema migrations removed | — | (unify) |
| FR-SETUP-04 | Native directory picker in wizard (Browse button) | done | 72ba219 |
| FR-SETUP-10 | Import auth verification (re-auth if credentials missing) | done | 72ba219 |
| — | Settings re-auth prompt when configured provider lacks auth | done | 72ba219 |

## Sprint: UX + distribution (2026-07-23)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-09 | Local file links open via shell.open() | done | a22cbda |
| FR-DEFERRED-03 | OS notifications for due deferred items | done | 2bca847 |
| E12 | Production worker sidecar (bun compile + externalBin) | done | 74e871a |

**Tests at sprint close:** 182 unit + 104 BDD green.

## E13 — Production reflect (2026-07-23)

| Item | Description | Status | Commit |
|------|-------------|--------|--------|
| E13a | Reflect child fork-only context (no system prompt, no skeleton LLM input) | done | 91a689a |
| E13b | Argv dispatch (`--reflect`) + compiled spawn path | done | d945322 |

**Tests at E13 close:** 193 unit + 104 BDD green.

## Production hardening (2026-07-23)

| Fix | Description | Commit |
|-----|-------------|--------|
| Heartbeat rate limit | Guard against runaway timer in Bun binary (5s min gap) | 2b56f20 |
| Fork bomb defense | argv.includes dispatch + BUDDY_REFLECT_CHILD env guard + markPendingInProgress | c548911 |
| Deferred notify guard | Concurrency lock prevents notification plugin flood | f2a5c56 |
| Deferred parser | Tolerate optional HH:MM in entry dates | 2e2ae95 |
| Heartbeat observability | heartbeat_tick JSONL event for debugging | 4b4be94 |
| UI: hide stale indicators | Thinking + tool-activity bubbles hidden after turn ends | ddcb441 |
| Local file links | Migrate FR-CHAT-09 from shell `open()` to opener `openPath()` | b487784 |

## Codebase cleanup (2026-07-23)

| Item | Description | Commit |
|------|-------------|--------|
| Batch 1 | Unify constants, remove dead exports, DEFAULT_LANGUAGE fallback | 728ba82 |
| Batch 2 | Test infra: shared constants, parallel-safe env, reflect-recovery coverage | 29286eb |
| Batch 3 | Prune tool-activity from state, sidecar target script, remove dead reflectInFlight | 10b4fcb |
| getState removal | Remove dead AgentState + getState from entire RPC stack | 8b66be1 |
| Notification content | Show actual reminder text in OS notification + re-show banner mid-session | b487784 |
| ProviderAuthForm | Extract shared OAuth/API key UI from wizard + settings | 7fba097 |

**Tests at cleanup close:** 201 unit + 104 BDD green.

## E14 — Skeleton/pending cleanup (2026-07-24)

| Item | Description | Commit |
|------|-------------|--------|
| E14 | Remove skeleton/pending infrastructure; fork-only reflect with spawn metadata args; drop crash-catchup | b1e755e |

**Tests at E14 close:** 193 unit + 102 BDD green.

**Remaining:** none — skeleton cleanup complete.

## E15 — Cost visibility + budget limits (2026-07-24)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-COST-02 | Usage panel in Settings (session + monthly) | done | a68d228 |
| FR-COST-03 | Budget warning (80%) + hard limit (100%) with OS notifications | done | a68d228 |

**Tests at E15 close:** 268 unit + 136 BDD green.

## Current focus

> **SPRINT: Hardening (v0.1.1) — IN PROGRESS.** Triggered by the external code
> review of 2026-07-26 (Opus 5) and the project response of 2026-07-27.
> **FR-WIKI is deferred until H1–H3 close.**
>
> **H1 done** (link containment). **350 unit + 173 BDD green**, typecheck clean.
> **Next: H2** (render safety — sanitize markdown, define CSP).

### Sprint: Hardening (v0.1.1) — started 2026-07-27

**Why now:** v0.1.0 "Ana" is publicly released and installed on at least two
machines. The review found one confirmed path traversal, one confirmed XSS, and
an unbounded consolidation retry loop that can drain a real user's budget with no
attacker involved. Feature work pauses until Block A is green.

Sliced into six sprints by unit of change, not by severity. **Every sprint ends
green** — full suite passing and `tsc --noEmit` clean — so any of them is a
shippable stopping point.

**Transversal:** NFR-TEST-01 (adversarial scenario required) is a `done`
criterion for every item below, not a separate work item.

---

#### Sprint H1 — Link containment `[M]` — DONE (2026-07-27)

Goal: the webview can no longer name, read, or launch anything on the filesystem.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| FR-CHAT-11 | Local links view-only, internal, scoped | done | (this sprint) |
| NFR-SEC-08 | Single path-containment authority | done | (this sprint) |
| NFR-SEC-09 | Frontend holds no filesystem capability | done | (this sprint) |

**Tests at H1 close:** 350 unit + 173 BDD green, typecheck clean (was 313 + 162).

New modules: `shared/viewable-path.ts` (containment authority, browser-safe) ·
`backends/viewable-file.ts` (enforcement + read).
Removed: `resolveLocalPathForOpen`, `LocalLinkAction` type `"open"`,
`FileViewerController.openExternally`, `openPath` from `ChatView`, the
external-open button and its i18n key.
Capabilities dropped: `fs:allow-read-text-file`, `opener:allow-open-path`.
`opener:allow-open-url` narrowed from `http`+`https` to `https` only.

**Design note — where the authority actually lives.** NFR-SEC-08 is worded as
"one worker-side module". In practice the *rule* lives in `shared/viewable-path.ts`
(browser-safe, no `node:path`) and the *enforcement* in `backends/viewable-file.ts`.
The frontend imports the shared rule only to decide whether to render a link as
clickable — presentational, non-authoritative. Nothing is read until the worker
validates again. Writing the rule twice is exactly how S1 happened, so one
implementation shared by both sides is the point.

Verified against the original review probes: `../../secret.md`, `../.ssh/id_rsa`,
`downloads/x.command` and `downloads/Evil.app` all resolve to `null`.

Touches: new worker path-authority module · `shared/api.ts` (+`readViewableFile`) ·
`agent-worker.ts` · `local-path.ts` (drop `resolveLocalPathForOpen`) ·
`local-link-handler.ts` · `file-viewer-controller.ts` · `file-viewer-factory.ts` ·
`FileViewer.svelte` (drop external-open button) · `ChatView.svelte` (drop `openPath`) ·
`capabilities/default.json`

Exit: 173/173 BDD green · typecheck clean · `fs:*` and `opener:allow-open-path`
absent from capabilities · no `openPath` import anywhere in `src/`

**First by necessity, not by priority:** the suite is already red from this work.
Nothing else can ship until it closes.

#### Sprint H2 — Render safety `[S]`

Goal: nothing the LLM or a file can say becomes executable markup.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-10 | Markdown output sanitized before `{@html}` | todo | |
| NFR-SEC-11 | CSP defined (`csp: null` prohibited) | todo | |

Touches: `markdown.ts` · `tauri.conf.json` · `package.json` (sanitizer dep) ·
new `specs/features/markdown-safety.feature`

Exit: raw HTML neutralized · fence `language` escaped · `data-local-path` still
survives sanitization (FR-CHAT-09/10 must not silently break) · CSP present with
`script-src` free of `unsafe-inline`/`unsafe-eval` · app visually verified in the
real window, not only in tests

#### Sprint H3 — Consolidation cost safety `[M]`

Goal: background maintenance can never drain a user's budget unattended.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| FR-CONSOL-08 | State persisted per completed depth | todo | |
| FR-CONSOL-09 | Failure backoff + retry ceiling | todo | |
| FR-COST-05 | Budget gate aborts in-flight cascade | todo | |

Touches: `consolidation-runner.ts` · `heartbeat.ts` · `shared/consolidation-state.ts` ·
`consolidation-scheduler.feature`

Exit: depth-2 failure keeps depth-1's advance · backoff grows across consecutive
failures · ceiling reached → abandoned + user told in plain language · crossing 95%
mid-cascade stops at the next depth boundary with journal status `budget-stopped`

**Fully independent of H1/H2** — if budget drain is observed in the wild, branch
from the last green commit and ship this first.

#### Sprint H4 — Network trust boundary `[M]`

Goal: `fetch_url` cannot reach the local network, and what it returns is data.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-12 | SSRF protection in `fetch_url` | todo | |
| FR-NET-03 | Untrusted content framing | todo | |

Touches: `fetch-url.ts` · `bundled/prompts/agents-base.md` · `fetch-url.feature`

Exit: loopback, link-local, metadata and private ranges refused after DNS
resolution **and** after each redirect hop · size enforced on accumulated bytes
during streaming · fetched content delimited as untrusted in context

#### Sprint H5 — Session factory and shared state `[L]`

Goal: one way to create a session; one writer discipline for shared files.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-14 | Single authenticated-session factory | todo | |
| NFR-REL-06 | `usage.json` concurrent-write safety | todo | |

Touches: new `backends/session-factory.ts` · `session-boot.ts` · `reflect-child.ts` ·
`consolidation-runner.ts` · `warm-handoff.ts` · `usage-tracker.ts`

Exit: no call site constructs a session directly · every path supplies buddy's own
`ModelRuntime` · concurrent-writer test shows no lost update

**Largest and riskiest.** Touches `reflect-child.ts`, which is unreviewed and
already produced one auth bug (`231ac31`). Do the second-pass review of that file
as part of this sprint, not after.

#### Sprint H6 — Containment cleanup `[S–M]`

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-13 | Path-bearing tool args declared | todo | |
| NFR-SEC-15 | Symlink resolution in containment | todo | |
| NFR-REL-07 | Atomic lock acquisition (`wx`) | todo | |
| NFR-CONFIG-05 | Single config-dir resolver | todo | |

Plus review items M1–M7 (unused `pageUrl`, double `parseHTML`, 2.2 MB generated
asset committed, `this` in usage-tracker literals, empty catch audit).

---

**Suggested release grouping**

| Release | Sprints | Rationale |
|---------|---------|-----------|
| v0.1.1 | H1 + H2 + H3 | The two confirmed-exploitable findings plus the one that spends real money |
| v0.1.2 | H4 + H5 | Structural; no confirmed exploit, but closes the injection and auth patterns |
| v0.1.3 | H6 | Cleanup |

**Spec amendments made by this sprint (deliberate divergence, not drift):**

| What | Why |
|------|-----|
| FR-CHAT-09 | Withdrew the `openPath()` click behavior. Buddy no longer opens files with external programs. |
| FR-CHAT-10 | Removed the "Open externally" affordance; content now read by the worker. |
| NFR-REL-04 | Amended — original wording specified the unbounded retry loop that is R1. |
| FR-NET-01 | Noted that destination safety is worker-side, not user domain approval. |

**BDD scenarios deliberately deleted:** `Clicking a PDF link falls back to the
system app` and `Open externally uses the system opener` — both encoded the
behavior now considered unsafe.

**ID collisions found while planning** (avoid re-using): `NFR-SEC-07` (credential
isolation), `NFR-CONFIG-04` (boot refresh), `FR-NET-02` (web search) were already
taken by unrelated requirements.

**Not yet reviewed** (second-pass candidates): `reflect-child.ts`,
`oauth-service.ts`, `setup-controller.ts` / `SetupWizard.svelte`, `scripts/`.
Verified clean during planning: dev bridge (`import.meta.env.DEV`-gated),
`hebbian.ts` (cannot write outside `agent_brain/`).

### Jul 26 — PDF extraction compiled-binary fix (2026-07-26)

| Item | Description | Commit |
|------|-------------|--------|
| Embedded pdfjs worker | `generate-embedded-assets.ts` embeds `pdf.worker.min.mjs`; `pdf-extract.ts` writes to temp on first use | 5200f6e |
| EmbeddedAssets interface | Added `pdfWorker?: string` field | 5200f6e |
| Sidecar registration | `sidecar-entry.ts` passes `EMBEDDED_PDF_WORKER` to `registerEmbeddedAssets()` | 5200f6e |

### Jul 26 — File operations tools — DONE (2026-07-26)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-DELETE-01 | Restricted file deletion (user confirmation) | done | (this sprint) |
| FR-FILE-01 | copy_file (external → user/downloads) | done | (this sprint) |
| FR-FILE-02 | move_file (within workspace, git mv) | done | (this sprint) |

**Tests at file ops close:** 308 unit + 163 BDD green.

### Jul 26 — Session boot, reflect quality, docs sync — DONE (2026-07-26)

| Item | Description | Commit |
|------|-------------|--------|
| Context injection fix | Silent injection before worker core; no visible boot response | 8690d7f |
| Warm handoff fix | Moved before worker core; prevents duplicate greeting events | 72f6ce0 |
| First-session skip | Skip context injection when `firstSession && personalizationPending` | 28f88c0 |
| Reflect prompt rewrite | Lean process-conversation.md; synthesize don't transcribe; omit empty sections | 558761f |
| OUTPUT_ONLY_SUFFIX | Produce ONLY `## Session HH:MM–HH:MM` block | 558761f |
| Core skills removed from templates | `agent_brain/skills/.gitkeep` only; core prompts in `~/.buddy/prompts/` | e10560c |
| AGENTS.md identity | "Buddy, a personal assistant" (not "context processor") | 3bb1409 |
| agents-base self-reference | Docs authoritative for capability/memory questions | c25ea88 |
| GTD explainer | Added to `bundled/docs/capabilities.md` | 4962adf |
| Reflect eval harness | `scripts/test-reflect.ts` + 5 conversation fixtures | a1bff51 |
| FR-PROMPT-04 | Marked done in SPEC | (doc sync) |

**Tests at session-boot sprint close:** 287 unit + 149 BDD green.

### Bug fixes + self-awareness prompt (2026-07-25)

| Fix | Description | Files |
|-----|-------------|-------|
| FR-CHAT-05 | Stale "Pensando..." after turn: removed toggle, indicator transient-only | MessageBubble.svelte, i18n |
| FR-PERM-06 | "Allow always" never persisted: dropped `persist` arg in ChatView + stale in-memory ref in gate | ChatView.svelte, permissions.ts, session-boot.ts, agent-worker.ts |
| FR-DOCS-01 (partial) | Self-awareness block in `agents-base.md`: tools list, capabilities, limitations, pointer to `~/.buddy/docs/` | bundled/prompts/agents-base.md |

**Tests after fixes:** 287 unit + 146 BDD green.

### FR-NET-01: URL content fetch — DONE (2026-07-25)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-NET-01 | `fetch_url` tool (HTML→markdown, PDF, image) | done | e2750d1 |

**Tests at FR-NET-01 close:** 286 unit + 146 BDD green.

### E16 — Consolidation relocate tool (2026-07-25)

| FR-ID | Feature | Status | Notes |
|-------|---------|--------|-------|
| FR-CONSOL-07 | `relocate_brain_file` tool (git mv + link rewrite) | done | Consolidation sessions only |
| FR-SKILL-05 | Skill tools wired into maintenance session | done | `triage_inbox` via tool, not file read |

**Tests at E16 close:** 273 unit + 139 BDD green.

Resolves eval issue #8 — depth-3 grouping can now physically move files into subdirectories.

### Eval sprint: FR-BRAIN-04/05 consolidation quality — DONE (2026-07-25)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-BRAIN-04 | Consolidation skill produces meaningful summaries | done | b9c5ee3 |
| FR-BRAIN-05 | Observation pipeline captures and promotes patterns | done | b9c5ee3 |

Eval results in `my-ab/agent_brain/projects/agentic-buddy/eval-results.md`. 5 runs (depth 1–3). Fixes shipped:
- Ripe observation extraction + injection into consolidation prompt header
- Programmatic `logs/index.md` update from Day summary Key themes (worker code, not LLM)
- Depth 2/3 explicit steps in `consolidation.md` (weekly journal, idea review, grouping, hygiene)
- Maintenance index upsert preserves curated active descriptions (`10d39dc`)

**Tests at sprint close:** 268 unit + 136 BDD green.

Issue #8 (physical brain file grouping) resolved in E16 via FR-CONSOL-07.

### Sprint 3.5: Inline file viewer — DONE (2026-07-25)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-10 | Inline file viewer for markdown/text links | done | 5299c10 |

**Tests at sprint close:** 262 unit + 136 BDD green.

### Sprint 3: Brain format + health linter — DONE (2026-07-25)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| NFR-FORMAT-01 | `summary` frontmatter in agent_brain templates | done | d948936 |
| FR-BRAIN-07 | Brain health linter (structural checks, worker code) | done | d948936 |

**Tests at sprint close:** 250 unit + 128 BDD green.

### Sprint 2: Skills as Tools — DONE (2026-07-25)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-SKILL-01 | Skill tools registered at session creation | done | 7a40949 |
| FR-SKILL-02 | process_conversation tool for manual reflect | done | 7a40949 |
| FR-SKILL-03 | triage_inbox tool for inbox processing | done | 7a40949 |
| FR-SKILL-04 | Reflect child uses bundled process-conversation prompt | done | 0588329 |
| FR-SKILL-05 | Consolidation invokes triage via tool call | done | (see E16) |
| FR-BRAIN-06 | AGENTS.md skill-free (skills via tool descriptions) | done | a835d09 |

**Tests at sprint close:** 237 unit + 122 BDD green.

### Sprint 1: Reflect realignment + housekeeping — DONE (2026-07-25)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-REFLECT-03 | Compaction-only checkpoint trigger (turn count removed) | done | fd5ee21 |
| FR-REFLECT-05 | Session persistence + crash recovery | done | bfa505a |
| NFR-MIGRATE-06 | Boot refresh on app version change (prompts + docs deploy) | done | (unify) |
| NFR-MAINT-01 | Session log retention (7-day prune) | done | 7845c28 |

### Sprint: Settings access UI — DONE (2026-07-22)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-SETTINGS-05 | Gear icon + Buddy → Settings menu (Cmd+,) | done | 2e051c5 |

### Sprint: Settings model switch — DONE (2026-07-21)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-SETTINGS-03 | Cross-provider model dropdown + add-provider auth | done | cece2f0 |
| FR-SETTINGS-04 | Language switching (from FR-SETTINGS-02) | done | 6ea7f89 |

Model switch resolves Pi models via `ModelRuntime`, persists to `.pi/settings.json`
and `~/.buddy/config.json`. Input bar model selector remains future work (FR-SHELL-05 gap).

### Sprint: Chat polish + Settings — DONE (2026-07-21)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-08 | Textarea height reset after send | done | 491b6e9 |
| FR-REFLECT-04 | Reflect log output sanitizer | done | 7c5bd69 |
| FR-SETTINGS-02 | Settings modal (Cmd/Ctrl+,) | done | 6ea7f89 |

### Sprint: OAuth Setup — DONE (2026-07-20)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-SETUP-05 | OAuth primary + API key fallback + live model list | done | da071a6 |

Also: `ProviderStep` / `ModelStep` wizard components; `OAuthService` worker wrapper;
`provider-mapping.ts` (ab-app ↔ Pi SDK ids); BDD `setup-oauth.feature` (3 scenarios).

### Sprint: Chat Display Polish — DONE (2026-07-20)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-05 | Thinking block display (transient indicator) | done | 5e89120 |
| FR-CHAT-06 | Tool call display (expandable activity block) | done | 5e89120 |
| FR-DEFERRED-01 visual | Welcome banner with deferred cards or greeting | done | 5e89120 |

Also: `logs/index.md` format fix (stem as key, no truncation) — `30b4296`, `6f88dd1`.

### Sprint: File Ingest — DONE (2026-07-19)

| FR-ID | Feature | Status |
|-------|---------|--------|
| FR-INGEST-01 | Drag & drop onto chat window | done |
| FR-INGEST-02 | Attach button (native file picker) | done |
| FR-INGEST-03 | Implicit read permission for attached paths | done |
| FR-INGEST-04 | Format validation (.md, .txt, extensionless) | done |
| FR-INGEST-05 | Image attachments via Pi vision API | done |

### Sprint: Reflect Hardening — DONE (2026-07-19)

Post-review fixes from `REVIEW-HANDOFF.md` findings A + B + G + C:

| Fix | Description | Commit |
|-----|-------------|--------|
| A | True fork via `SessionManager.forkFrom` (child no longer writes to live JSONL) | fe8c242 |
| B | Write-phase-only lock with retry in reflect child (prevents git index.lock races without blocking LLM) | c647df3 |
| G | `lifecycle.flush()` before shutdown (no lost events) | fe8c242 |
| C | BDD catch-up test realigned to production spawn path (`reflect-recovery.ts`) | 50ad118 |

### Sprint: Config Defaults + Doc Sync — DONE (2026-07-19)

| Task | Description | Commit |
|------|-------------|--------|
| NFR-CONFIG-01/03 | `shared/defaults.ts` — centralized operational + security constants | 2b9bc53 |
| Finding E | Unified model catalog (detect-auth uses model-catalog helpers) | 2b9bc53 |
| Finding D | Incremental reflect uses fast-tier model + minimal thinking | 2b9bc53 |
| Doc sync | specs/SPEC.md + docs/app-spec-tauri.md aligned with forkFrom, systemPromptOverride | 2b9bc53 |

### Sprint: Misc fixes — DONE (2026-07-19)

| Task | Description | Commit |
|------|-------------|--------|
| Index format | logs/index.md uses one-liner summaries + path format description | 5f91d12, c647df3 |
| i18n locale | Detect system locale on startup + bilingual language picker | 7067065 |
| FR-INGEST-05 | Image attachments via Pi vision API (PromptOptions.images) | b894fe0 |

### Sprint: Memory Loop — DONE

| Order | FR-ID | Feature | Status |
|-------|-------|---------|--------|
| 1 | FR-GIT-01 | Auto-commit after agent writes | done |
| 2 | FR-SESSION-03 | Session end on app close | done |
| 3 | FR-REFLECT-01 | Factual skeleton (crash fallback) | done |
| 4 | FR-REFLECT-02 | Forked reflect on session end (background child) | done |
| 5 | FR-REFLECT-03 | Incremental mid-session reflect (background child) | done |
