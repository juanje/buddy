# Implementation Progress

Open work only. When something closes it leaves this file — git and
`docs/releases/` remember it. FR status lives in `specs/SPEC.md` and is checked
by `tests/unit/fr-status.test.ts`; rationale lives in `docs/`.

**Focus: polishing UX, infrastructure, CI and distribution.** The MVP feature
set is in place. Distribution counts as UX upstream — a package that installs
badly, or a platform with no build at all, is a user who never reaches the UI.
Nothing in the backlog starts until the MVP is considered finished.

## In flight

| Item | State | Note |
|------|-------|------|
| FR-CHAT-18 — export to PDF from the viewer | **blocked on a spike** | Whether `window.print()` works in the Tauri webview decides between an afternoon and several days of per-platform Rust. WKWebView has historically not implemented it. Measure on macOS and Linux before designing further. |

## Open

Verified 2026-08-07.

| Item | Where | Note |
|------|-------|------|
| FR-REFLECT-07 has no test | `backends/reflect-child.ts:249` | The watchdog is implemented and correct; nothing trips it. Not marked ✓, and it should not be until a test exists. |
| 20 FRs marked ✓ that no test names | `UNBACKED_BASELINE` in `tests/unit/fr-status.test.ts` | Frozen so it cannot grow. Three different problems — the comment there sorts them. FR-SETTINGS/FR-GIT are the cheap ones: the tests exist, they just don't cite the ID. |
| Three oversized functions, partially extracted | `agent-worker.ts` `main()` (~290 lines), `createSetupController` (~325), `createChatController` (~255) | One safe extraction done in each: pieces with no closure over the function's mutable state moved out with their own tests (`buildAuthStatus`, `classifyAttachments`, `resolveImportProvider` hoisted). The pattern: extract when a feature is already touching that area, not as a standalone project. Still open — the bigger, stateful pieces (the message-list reducer in chat-controller, the pending-permission registry in main(), step navigation in setup-controller) need real restructuring, not just a move. |
| `"Login cancelled"` as a string sentinel across RPC | `backends/oauth-service.ts` + two frontend controllers | Documented at `shared/api.ts:97`. |
| `toBuddyRelPath` is a second lexical containment helper | `shared/path-utils.ts`, used by `hebbian.ts` / `hebbian-guard.ts` | **Not a hole** — both callers are trackers, not enforcement, and it collapses `..`. But `containment.ts`'s header reads as though all four helpers were consolidated. Move the callers to `containedRelPath`, or say in the header why tracking is exempt. |
| `worker-proxy.ts` boilerplate; duplicated lock loop in `state-file.ts`; duplicated provider-auth flow across the two controllers | — | Maintenance audit leftovers. Cosmetic. |


**Watching, not a defect of ours: `pi.dev` accepts connections and never
answers.** Startup no longer waits on it, and the catalogue refresh is bounded
at 2s (NFR-REL-09), so a cold launch pauses once and proceeds on the cached
catalogue. Pi issues #7113 and #7443 are the same outage on SDK paths that have
no timeout at all; the path Buddy uses does.

**Pi SDK is three minors behind.** Installed 0.80.10, latest 0.83.0. Not urgent
— the catalogue timeout is handled here, and #7113 is still open upstream — but
0.83 changed `ModelRuntime.create` so the network refresh runs only when
`allowModelNetwork` is explicitly true. `createBuddyModelRuntime` now states it,
so the upgrade is safe to make. Give it its own cycle with a dev run, like the
actions bump.

**Declined, do not re-open:** the third `saveConsolidationState` in
`runConsolidation`. Reviewed twice, kept on purpose; the reason is in a comment
at the call site.

## Distribution

Verified 2026-08-07 against `release.yml`, `scripts/build-worker.sh` and
`tauri.conf.json`. CI builds macOS (ARM64 + x64) + Linux x64 (deb + rpm) on
every tag since v0.1.0. **Windows:** no installer until Block 1 NFRs in
`SPEC.md` §4.4.0 have tests (Spec → BDD/unit → code). Local work on branch
`windows-port` only — do not push upstream until asked. Tooling cwd:
`D:\WORK\PROJECTS\APPS.windows\buddy` (not this PARA `buddy_repo_original`
path — `#` in parent breaks Vite). Installer drop (Block 2): `../buddy_DIST/windows/`
(empty until then). Shortcut from PARA hub: `../buddy_worktree (APPS.windows).lnk`.

| Item | State | Note |
|------|-------|------|
| Workflow actions | current | `checkout` and `setup-node` on v7, `setup-bun@v2`, `rust-cache@v2`, `tauri-action@v1` all on their current major. Why each v7 change does not apply is in a comment in `ci.yml` — worth re-reading before adding a `pull_request_target` or `workflow_run` trigger. Dependabot raises majors as their own PR. |
| Linux arm64 is never built | **gap, cheap** | `build-worker.sh` already maps `aarch64-unknown-linux-gnu`, and the release matrix only runs `ubuntu-22.04` at x86_64. The sidecar half of the work is done. |
| No distro-agnostic Linux artifact | open | `bundle.targets` is `["dmg", "app", "deb", "rpm"]`. AppImage was dropped (`03b91dc` — linuxdeploy broken on GH runners). Flatpak not started. No distro-agnostic option currently. |
| NFR-PORT-06 — CRLF write guards (spike A7) | **closed** (`4ff79f4`) | Shared frontmatter matcher; unit + write-guard.feature CRLF scenario. |
| NFR-SEC-17 amend — Windows ACLs for `~/.buddy/` (A1) | **blocks Windows** | Decision: explicit ACLs (not silent chmod). |
| NFR-SEC-04 / FR-PERM-04 amend — case-insensitive denylist (A2) | **closed** | Basename match via case-fold; unit + permissions.feature. |
| NFR-SEC-21 — Windows sensitive paths (A3) | open | `%APPDATA%\gnupg` + Credential Manager dirs. |
| NFR-SEC-22 — illegal/reserved filenames (A4) | **blocks Windows** | ADS `:` and `NUL`/`CON`/… |
| NFR-SEC-15/16 — containment Windows shapes (A5) | **blocks Windows** | Junctions, UNC, `\\?\`, short names. |
| NFR-PORT-07 — consolidation link rewrite separators (A6) | **closed** | `resolveMarkdownLink` → `isContained`; unit + consolidation-relocate.feature. |
| NFR-PORT-08 — `.gitattributes` on create (A8) | open | After NFR-PORT-06. |
| NFR-REL-11 — portable reflect interrupt (A9) | open | SIGTERM / shell quoting / git lock. |
| Detached reflect child (spike C1) | open | Needs real Windows machine after Block 1. |
| `build-worker` Windows target + NSIS (Block 2) | blocked | Mechanical after A1–A7; no `windows-latest` CI until correct. |

## Backlog (post-MVP)

- **FR-WIKI Sprints 1–3 shipped (wiki branch, 2026-08-11):** Sprint 1:
  `wiki_search`, `wiki_file` (lightweight capture), bootstrap, backlinks, index
  regeneration, always-on registration (FR-WIKI-01/03/04/07/09). Sprint 2:
  `wiki_check` + `wiki_repair_links`, post-write health, heartbeat wiki audit
  with `wiki-state.json` (FR-WIKI-05). Sprint 3: `wikiSynthesisCandidates` L1
  heuristics, `runWikiSynthesis` fast-tier session with code-enforced 3-page
  cap, heartbeat synthesis task with growth/cooldown/budget gates
  (FR-WIKI-06). **Still open:** FR-WIKI-02 (document ingest + child session),
  FR-WIKI-08 (progress phases) — Sprint 4 per wiki-roadmap.
- **FR-PROVIDER** — Aug 2026 eval shows Qwen 27B viable for chat + reflect,
  gemma 12B for chat only. Harness hardening (#7, #26, #14) remains before
  FR-PROVIDER. Pi SDK upgraded to 0.84.x (FR-SDK-01/02/03). FR-PROVIDER-01..03
  criteria enriched with compat flags, `contextWindow` requirements, and
  `thinkingFormat` handling. Not yet scheduled.
- **FR-SYNC**, **FR-NET-02**, **FR-COST-04** — phase 3+.

## State

Released through **v0.1.21** (2026-08-11). Phase 0 and Phase 1 complete; the
H1–H8 hardening, local-model evaluation and maintenance-audit campaigns are all
closed. v0.1.17 shipped extended ingest formats (CSV, JSON, YAML, log),
structured rejection reasons, preference tracking in USER.md, the
consolidation user-model update step, Markov self-sufficiency eval
(`scripts/eval-markov.ts`), and consolidation model tiering by depth
(FR-CONSOL-15: depths 1-2 use fast tier with thinking off, depth 3 uses the
configured model). **FR-GUARD-02** (edit-failure recovery hints + prompt rule)
and **FR-GUARD-03** (post-consolidation filename validation + broken-link
repair) close harness items #2b and #15. **Pi SDK 0.84.x** shipped
(FR-SDK-01/02/03: delta-only streaming fixtures, session API compat,
sidecar deep-import guard). **NFR-SEC-19 amendment (2026-08-08):** live Pi
session JSONL files now stored under `<rootDir>/.buddy/sessions/` with 7-day
pruning (NFR-MAINT-02); source guard on `SessionManager.create`. **NFR-REL-10:**
worker reconnect releases the previous kkrpc channel (fixes doubled streaming
after crash + restart). **FR-SHELL-07/08/09** (Linux native menu polish: About icon,
hide empty Window menu, menu label i18n es/en) shipped in the same cycle.
Per-release detail in `docs/releases/`.
