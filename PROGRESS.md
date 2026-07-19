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
| FR-SETUP-05 | Provider authentication (OAuth primary) | rework pending | 78e3ab4 (API key only) |
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
| FR-PERM-07 | Permission prompt in chat | done | 1031c99 |
| FR-SESSION-01 | Fresh session on every launch | done | rework-sprint |
| FR-SESSION-02 | New session | N/A (every launch is fresh) | |
| FR-SESSION-03 | Session end on app close | pending | |
| FR-REFLECT-01 | Factual skeleton on session end | pending | |
| FR-REFLECT-02 | Catch-up reflect on start | pending | |
| FR-DEFERRED-01 | Surface deferred on start | done | d7a3c12 |
| FR-INGEST-01 | Drag & drop file ingest | pending | |
| FR-INGEST-02 | Attach button | pending | |
| FR-GIT-01 | Auto-commit after writes | pending | |
| FR-GIT-02 | Index rebuild on session end | pending | |
| NFR-I18N | Locale module (es + en) | done | rework-sprint |

## Phase 3 — Chat polish (early)

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-04 | Markdown rendering in assistant messages | done | 37b55dc |

**Phase 1 complete:** NO

## Current focus

> **Rework sprint complete (2026-07-19).** FR-CHAT-04 markdown rendering shipped early
> for better chat UX during testing. Next: FR-GIT-01 (auto-commit), FR-REFLECT-01/02,
> FR-INGEST-01/02. FR-SETUP-05 OAuth deferred.
