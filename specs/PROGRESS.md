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
every tag since v0.1.0. Suggested order: Linux arm64 first (cheap, visible),
then the POSIX→Windows audit as its own block with its own NFRs, then the CI
target — there is no point wiring a runner for something not yet correct.

| Item | State | Note |
|------|-------|------|
| Workflow actions | current | `checkout` and `setup-node` on v7, `setup-bun@v2`, `rust-cache@v2`, `tauri-action@v1` all on their current major. Why each v7 change does not apply is in a comment in `ci.yml` — worth re-reading before adding a `pull_request_target` or `workflow_run` trigger. Dependabot raises majors as their own PR. |
| Linux arm64 is never built | **gap, cheap** | `build-worker.sh` already maps `aarch64-unknown-linux-gnu`, and the release matrix only runs `ubuntu-22.04` at x86_64. The sidecar half of the work is done. |
| No distro-agnostic Linux artifact | open | `bundle.targets` is `["dmg", "app", "deb", "rpm"]`. AppImage was dropped (`03b91dc` — linuxdeploy broken on GH runners). Flatpak not started. No distro-agnostic option currently. |
| `~/.buddy/` security modes are POSIX-only | **blocks Windows** | `CONFIG_DIR_MODE` 0700, `AUTH_FILE_MODE` / `STATE_FILE_MODE` 0600, applied at creation (NFR-SEC-17). `chmod` on Windows is close to a no-op, so credentials, granted paths and config would sit readable by every user of the machine. This is not packaging — it is an NFR that Windows breaks silently, and silent is the failure mode this project has already been bitten by. Needs explicit ACLs or a written, conscious exception. |
| `containment.ts` symlink semantics | **blocks Windows** | It resolves with `realpathSync` (NFR-SEC-15/16). Windows has junctions, symlinks that need privilege, UNC paths and `\\?\`. This is the module the project calls "one authority", and where the fourth answer to the same question was already wrong once. Porting it without Windows-specific tests is exactly the pattern that has bitten before. |
| Detached reflect child | open | `--reflect` argv dispatch, detached spawn and the hard timeout all assume POSIX detach semantics. |
| `build-worker.sh` has no Windows target | open | Bash script with a case over four triples; `bun-windows-x64` is absent. Mechanical once the two security items above are settled. |

## Backlog (post-MVP)

- **FR-WIKI** — an extra feature, not the next one. Listed under *Explicitly NOT
  in v1* in `docs/app-design-principles.md`. **Designed 2026-08-02, still not
  scheduled.** The design was reviewed against the code and its decisions are
  now acceptance criteria in `SPEC.md` §3.18 (FR-WIKI-01..08, opt-in with a
  restart notice, markdown links, depth-1 health check gated on commits since
  the last run, depth-3 synthesis). One gap remains before any `.feature` can
  be written: reconciliation and enrichment — how an extracted concept merges
  into an existing page without losing what the user wrote — has an invariant
  but no procedure. The merge workflow still has to be designed and written
  before `.feature` files can be honest — those decisions require human-style
  judgment that the current spec does not yet encode.
- **FR-PROVIDER** — Aug 2026 eval shows Qwen 27B viable for chat + reflect,
  gemma 12B for chat only. Harness hardening (#7, #26, #14) remains before
  FR-PROVIDER. Pi SDK upgraded to 0.84.x (FR-SDK-01/02/03). FR-PROVIDER-01..03
  criteria enriched with compat flags, `contextWindow` requirements, and
  `thinkingFormat` handling. Not yet scheduled.
- **FR-SYNC**, **FR-NET-02**, **FR-COST-04** — phase 3+.

## State

Released through **v0.1.17** (2026-08-08). Phase 0 and Phase 1 complete; the
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
