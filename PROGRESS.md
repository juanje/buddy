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
| FR-SETUP-08 | Deterministic AB setup (populate USER.md from form) | done | rework-sprint |
| FR-SETUP-09 | First conversation warm handoff | done | rework-sprint |
| FR-SETUP-10 | Import existing instance | done | 7733b0e |
| FR-PROMPT-01 | System prompt assembly | done | d7a3c12 |
| FR-PROMPT-02 | Session-start enrichment | done | d7a3c12 |
| FR-PERM-01 | Zone 1: AB home silent allow | done | d3e57f3 |
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
| FR-REFLECT-03 | Incremental mid-session reflect (background child) | done | 6d58175 |
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
| NFR-AUTH-ISO | Auth isolation (AB ≠ Pi CLI) | done | (this commit) |

## Phase 3 — Chat polish (early)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-04 | Markdown rendering in assistant messages | done | 19eef12 |
| FR-CHAT-05 | Thinking block display (collapsible) | done | 5e89120 |
| FR-CHAT-06 | Tool call display (expandable activity block) | done | 5e89120 |
| FR-CHAT-08 | Input textarea resets height after send | done | 491b6e9 |
| FR-SETTINGS-02 | Settings UI (language + read-only config) | done | 6ea7f89 |
| FR-SETTINGS-03 | Cross-provider model switching + inline provider auth | done | cece2f0 |
| FR-SETTINGS-04 | Language switching from settings | done | 6ea7f89 |

**Phase 1 complete:** YES — all Phase 1 FRs implemented and passing (140 unit tests, 99 BDD scenarios).

## Phase 2 — Implemented early

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-HEBB-01 | Intercept read tool calls | done | b977e60 |
| FR-HEBB-02 | Frontmatter update | done | b977e60 |
| FR-HEBB-03 | Exclusions | done | b977e60 |
| FR-HEBB-04 | Lazy commit | done | b977e60 |
| FR-REFLECT-03 | Checkpoint mid-session reflect | done | fbee7f9 |
| FR-REFLECT-04 | Log output sanitizer | done | 7c5bd69 |

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

## Current focus

> **Sprint: Settings model switch (2026-07-21) complete.** FR-SETTINGS-03/04
> shipped. Next: Phase 2 (FR-CONSOL heartbeat, FR-WIKI, FR-COST).

### Sprint: Settings model switch — DONE (2026-07-21)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-SETTINGS-03 | Cross-provider model dropdown + add-provider auth | done | (this commit) |
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
| FR-CHAT-05 | Thinking block display (collapsible) | done | 5e89120 |
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
