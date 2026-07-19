# Implementation Progress

Track of implemented features. Updated ONLY when all acceptance criteria pass.

## Phase 0 — Architecture PoC

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-CHAT-02 | User input with send | done | 1a13fdd |
| FR-CHAT-01 | Streaming message display | done | eca5ce2 |
| FR-CHAT-03 | Abort generation | done | f858146 |
| FR-CHAT-07 | Auto-scroll with manual override | pending | |

**Phase 0 complete:** NO

## Phase 1 — MVP

| FR-ID | Feature | Status | Commit |
|-------|---------|--------|--------|
| FR-BRAIN-01 | AGENTS.md behavioral rules template | done | 2e79ede, 72edf52 |
| FR-BRAIN-02 | SOUL.md character definition | done | 2e79ede, 152ebc4 |
| FR-BRAIN-03 | USER.md placeholder template | done | 2e79ede |
| FR-SETUP-01 | First-run wizard UI | pending | |
| FR-SETUP-02 | Deterministic AB setup | pending | |
| FR-SETUP-03 | Agent-driven personalization | pending | |
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
> Next: FR-CHAT-07 (auto-scroll with manual override) — last Phase 0 feature
