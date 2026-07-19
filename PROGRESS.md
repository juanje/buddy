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
| FR-SETUP-03 | Location picker | pending | |
| FR-SETUP-04 | Provider and API key | pending | |
| FR-SETUP-05 | Model selection | pending | |
| FR-SETUP-06 | Deterministic AB setup | pending | |
| FR-SETUP-07 | Agent-driven personalization | pending | |
| FR-SETUP-08 | Import existing instance | pending | |
| FR-PROMPT-01 | System prompt assembly | pending | |
| FR-PERM-01 | Zone classification | pending | |
| FR-PERM-02 | Identity file protection | pending | |
| FR-SESSION-01 | Session resume | pending | |
| FR-SESSION-02 | New session | pending | |
| FR-REFLECT-01 | Factual skeleton on session end | pending | |
| FR-REFLECT-02 | Catch-up reflect on start | pending | |
| FR-DEFERRED-01 | Surface deferred on start | pending | |
| FR-INGEST-01 | Drag & drop file ingest | pending | |
| FR-INGEST-02 | Attach button | pending | |
| FR-GIT-01 | Auto-commit after writes | pending | |
| FR-GIT-02 | Index rebuild on session end | pending | |

**Phase 1 complete:** NO

## Current focus

> Brain templates (FR-BRAIN-01–03) implemented. Consolidation skill (FR-BRAIN-04) deferred
> until worker scheduler is ready.
>
> Phase 0 in progress. Project scaffolded (c758401): Tauri shell + Svelte + worker +
> BDD harness. Pi SDK spike verified: event names match spec; continueRecent() is
> sync + non-nullable.
>
> Phase 0 COMPLETE (FR-CHAT-02/01/03/07). Architecture validated: Svelte stores +
> framework-agnostic controllers + worker core, BDD suite green end-to-end.
> Native stack (spawn + real streaming + abort) validated on macOS (b036774).
>
> Phase 1 started. FR-SETUP-01 done (344a0d7): worker detects first run from
> ~/.ab-app/config.json (AB_CONFIG_PATH override), session only created when
> configured (cwd = AB dir), frontend routes to SetupWizard shell vs chat.
> Verified in the real app: fresh machine shows the wizard, no session spawned.
>
> Next: FR-SETUP-02 (wizard steps: prerequisites/location → deterministic AB
> setup), then FR-PROMPT-01. Testing policy: mocks/fakes by default; real-LLM
> smoke tests sparingly (Pi default model set to Haiku to keep them cheap).
