# Implementation Progress

Open work only. When something closes it leaves this file — git and
`docs/releases/` remember it. FR status lives in `specs/SPEC.md` and is checked
by `tests/unit/fr-status.test.ts`; rationale lives in `docs/`.

**Focus: polishing UX, infrastructure, CI and distribution.** The MVP feature
set is in place. Distribution counts as UX upstream — a package that installs
badly, or a platform with no build at all, is a user who never reaches the UI.
Nothing in the backlog starts until the MVP is considered finished.

## In flight

Showing the user a file. FR-CHAT-15 and FR-CHAT-16 shipped in v0.1.10.

| Item | State | Note |
|------|-------|------|
| FR-CHAT-17 — `show_file` opens the viewer | **done**, unreleased | Needs a version bump to reach existing installs: the capability is announced in `bundled/docs/capabilities.md`, which only redeploys on a version change. Untested in a running app so far. |
| FR-CHAT-18 — export to PDF from the viewer | **blocked on a spike** | Whether `window.print()` works in the Tauri webview decides between an afternoon and several days of per-platform Rust. WKWebView has historically not implemented it. Measure on macOS and Linux before designing further. |

## Open

Verified 2026-07-30.

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

## Open (found by manual testing, 2026-08-01 evening)

Both real, both pre-existing — neither introduced by this session's other
work, verified by checking whether the affected code was touched before today.

- **Fixed: `pickLocation` race in the setup wizard.** Picking a slow-to-validate
  directory, then a fast one before the first answer returned, let the stale
  answer win and overwrite the newer one — "import only" stuck no matter how
  many times the user picked a fresh directory afterward, including going
  back. A pick-token guard now discards a superseded validation.
- **Fixed: OAuth login could hang indefinitely.** The installed SDK's
  `ModelRuntime.login()` follows a successful token exchange with an
  unbounded model-catalogue refresh (no signal, no timeout — a different code
  path from the one NFR-PERF-02 bounded at startup). A stalled `pi.dev`
  (upstream pi#7113, open) hung it forever: browser step completes, Pi's own
  success page shows, app stuck on "Waiting for browser" until the frontend's
  own 30s RPC timeout fires. `OAuthService.login()` now waits for *this
  attempt's* credential to appear in Buddy's auth.json — comparing against a
  pre-login snapshot, since most logins are re-logins — and only then bounds
  what remains. A fixed timeout over the whole call was tried first and was
  wrong: `login()` contains the interactive browser step, so it raced the
  user. That produced both a false negative (a successful OpenAI login
  reported as an error) and a false positive (an Anthropic login reported as
  connected on the strength of a credential that predated it).

- **Fixed: a provider signed in from Settings vanished on reopening.** Sign in
  to a second provider, pick a model, use it — reopen Settings and it is
  offered as "sign in" again for the rest of the session, with its model still
  selected. `ModelRuntime.getProviderAuthStatus` answers from an in-memory
  snapshot that only updates when its own `refresh()` completes, and that is
  precisely the call a stalled `pi.dev` hangs. Consequence of not waiting for
  it (see above): correct to stop waiting, but the snapshot then never learns.
  `buildAuthStatus` now also consults Buddy's own auth.json, additively — the
  runtime is never overruled, since it sees credential sources auth.json
  cannot (runtime API keys, environment). Calling `refresh({allowNetwork:
  false})` to repair the snapshot was measured at 1ms and rejected anyway:
  `forceRefreshAvailability` chains behind the in-flight refresh, so it would
  inherit the very hang it was meant to work around.

## Distribution

Verified 2026-07-30 against `release.yml`, `scripts/build-worker.sh` and
`tauri.conf.json`. Suggested order: Linux first (cheap, visible), then the
POSIX→Windows audit as its own block with its own NFRs, then the CI target —
there is no point wiring a runner for something not yet correct.

| Item | State | Note |
|------|-------|------|
| Workflow actions | current | `checkout` and `setup-node` on v7, `setup-bun@v2`, `rust-cache@v2`, `tauri-action@v1` all on their current major. Why each v7 change does not apply is in a comment in `ci.yml` — worth re-reading before adding a `pull_request_target` or `workflow_run` trigger. Dependabot raises majors as their own PR. |
| Linux arm64 is never built | **gap, cheap** | `build-worker.sh` already maps `aarch64-unknown-linux-gnu`, and the release matrix only runs `ubuntu-22.04` at x86_64. The sidecar half of the work is done. |
| Only `deb` + `rpm` | open | `bundle.targets` is `["dmg", "app", "deb", "rpm"]`. No AppImage, no Flatpak — so no distro-agnostic Linux artifact. Package metadata also wants a review. |
| `~/.buddy/` security modes are POSIX-only | **blocks Windows** | `CONFIG_DIR_MODE` 0700, `AUTH_FILE_MODE` / `STATE_FILE_MODE` 0600, applied at creation (NFR-SEC-17). `chmod` on Windows is close to a no-op, so credentials, granted paths and config would sit readable by every user of the machine. This is not packaging — it is an NFR that Windows breaks silently, and silent is the failure mode this project has already been bitten by. Needs explicit ACLs or a written, conscious exception. |
| `containment.ts` symlink semantics | **blocks Windows** | It resolves with `realpathSync` (NFR-SEC-15/16). Windows has junctions, symlinks that need privilege, UNC paths and `\\?\`. This is the module the project calls "one authority", and where the fourth answer to the same question was already wrong once. Porting it without Windows-specific tests is exactly the pattern that has bitten before. |
| Detached reflect child | open | `--reflect` argv dispatch, detached spawn and the hard timeout all assume POSIX detach semantics. |
| `build-worker.sh` has no Windows target | open | Bash script with a case over four triples; `bun-windows-x64` is absent. Mechanical once the two security items above are settled. |
| `git` on PATH | **already handled** | `gitInstallInstructions` already has a `win32` branch in both locales. Nothing to do. |

## Backlog (post-MVP)

- **FR-WIKI** — an extra feature, not the next one. Listed under *Explicitly NOT
  in v1* in `docs/app-design-principles.md`.
- **FR-PROVIDER** — the local-model evaluation answered "not yet".
- **FR-SYNC**, **FR-NET-02**, **FR-COST-04** — phase 3+.

## State

Released through **v0.1.10** (2026-07-31). Phase 0 and Phase 1 complete; the
H1–H8 hardening, local-model evaluation and maintenance-audit campaigns are all
closed. Per-release detail in `docs/releases/`.
