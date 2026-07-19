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
| FR-SETUP-02 | Prerequisites check (git) | done | fc27fa8 |
| FR-SETUP-03 | Location picker | done | e3ce95e |
| FR-SETUP-04 | Provider and API key | done | 78e3ab4 |
| FR-SETUP-05 | Model selection | done | ada10c4 |
| FR-SETUP-06 | Deterministic AB setup | done | 7871e1e |
| FR-SETUP-07 | Agent-driven personalization | done | 7bb1a9f |
| FR-SETUP-08 | Import existing instance | done | 7733b0e |
| FR-PROMPT-01 | System prompt assembly | done | d7a3c12 |
| FR-PROMPT-02 | Session-start enrichment | done | d7a3c12 |
| FR-PERM-01 | Zone 1: AB home silent allow | done | d3e57f3 |
| FR-PERM-02 | Identity write confirmation | done | d3e57f3 |
| FR-PERM-03 | Zone 3: outside access prompt | done | d3e57f3 |
| FR-PERM-04 | Hardcoded denylist | done | d3e57f3 |
| FR-PERM-07 | Permission prompt in chat | done | 1031c99 |
| FR-SESSION-01 | Session resume | reverted | 835c997 (reverted by design) |
| FR-SESSION-02 | New session | N/A (every launch is fresh) | |
| FR-SESSION-03 | Session end on app close | pending | |
| FR-REFLECT-01 | Factual skeleton on session end | pending | |
| FR-REFLECT-02 | Catch-up reflect on start | pending | |
| FR-DEFERRED-01 | Surface deferred on start | done | d7a3c12 |
| FR-INGEST-01 | Drag & drop file ingest | pending | |
| FR-INGEST-02 | Attach button | pending | |
| FR-GIT-01 | Auto-commit after writes | pending | |
| FR-GIT-02 | Index rebuild on session end | pending | |

**Phase 1 complete:** NO

## Current focus

> **Bugs to fix before continuing Phase 1:**
>
> 1. Remove session resume (`session-resume.ts`): use `SessionManager.create()`
>    always — each launch is a fresh session. AB continuity is memory-based,
>    not conversation-resume. Delete stale sessions that cause retry loops.
> 2. Validate AB directory exists in `bootSession()`: if config.json points to a
>    missing path, show error + reconfigure option instead of broken session.
>
> **Design changes from user testing (2026-07-19):**
>
> - FR-SESSION-01 reverted: fresh session per launch, no resume.
> - FR-SETUP-04 redesign pending: OAuth login as primary auth (like Pi `/login`),
>   API key as fallback. Investigate Pi SDK login flow.
> - FR-SETUP-07 prompt rewritten: structured initial setup (ask name, language,
>   use case, style), explicit "rewrite USER.md completely" instruction (0523717).
> - Permission cards: user-friendly copy, no paths for identity writes (eb67120).
>
> **Next features after fixes:** FR-GIT-01 (auto-commit), FR-REFLECT-01/02,
> FR-INGEST-01/02.
