# Implementation Progress

Open work only. When something closes it leaves this file — git and
`docs/releases/` remember it. FR status lives in `specs/SPEC.md` and is checked
by `tests/unit/fr-status.test.ts`; rationale lives in `docs/`.

**Focus: polishing UX, infrastructure, CI and distribution.** The MVP feature
set is in place. Distribution counts as UX upstream — a package that installs
badly, or a platform with no build at all, is a user who never reaches the UI.
Nothing in the backlog starts until the MVP is considered finished.

## In flight

Showing the user a file. FR-CHAT-15 and FR-CHAT-16 shipped in v0.1.10; these
two remain and neither depends on the other.

| Item | State | Note |
|------|-------|------|
| FR-CHAT-17 — `show_file` opens the viewer | specified | New `FrontendAPI` callback + custom tool. Containment reuses FR-CHAT-11. Needs an entry in `bundled/docs/capabilities.md` or the user never learns it exists (FR-DOCS-01/02). |
| FR-CHAT-18 — export to PDF from the viewer | **blocked on a spike** | Whether `window.print()` works in the Tauri webview decides between an afternoon and several days of per-platform Rust. WKWebView has historically not implemented it. Measure on macOS and Linux before designing further. |

## Open

Verified 2026-07-30.

| Item | Where | Note |
|------|-------|------|
| FR-REFLECT-07 has no test | `backends/reflect-child.ts:249` | The watchdog is implemented and correct; nothing trips it. Not marked ✓, and it should not be until a test exists. |
| 20 FRs marked ✓ that no test names | `UNBACKED_BASELINE` in `tests/unit/fr-status.test.ts` | Frozen so it cannot grow. Three different problems — the comment there sorts them. FR-SETTINGS/FR-GIT are the cheap ones: the tests exist, they just don't cite the ID. |
| Three oversized functions | `agent-worker.ts` `main()` (282 lines, **no test at all**), `createSetupController` (331), `createChatController` (265) | `main()` would most repay it. Architectural — deliberately or not at all. |
| `"Login cancelled"` as a string sentinel across RPC | `backends/oauth-service.ts` + two frontend controllers | Documented at `shared/api.ts:97`. |
| `toBuddyRelPath` is a second lexical containment helper | `shared/path-utils.ts`, used by `hebbian.ts` / `hebbian-guard.ts` | **Not a hole** — both callers are trackers, not enforcement, and it collapses `..`. But `containment.ts`'s header reads as though all four helpers were consolidated. Move the callers to `containedRelPath`, or say in the header why tracking is exempt. |
| `worker-proxy.ts` boilerplate; duplicated lock loop in `state-file.ts`; duplicated provider-auth flow across the two controllers | — | Maintenance audit leftovers. Cosmetic. |

**Declined, do not re-open:** the third `saveConsolidationState` in
`runConsolidation`. Reviewed twice, kept on purpose; the reason is in a comment
at the call site.

## Distribution

Verified 2026-07-30 against `release.yml`, `scripts/build-worker.sh` and
`tauri.conf.json`. Suggested order: Linux first (cheap, visible), then the
POSIX→Windows audit as its own block with its own NFRs, then the CI target —
there is no point wiring a runner for something not yet correct.

| Item | State | Note |
|------|-------|------|
| Actions beyond checkout/setup-node | held on purpose | `setup-bun@v2`, `rust-cache@v2` and `tauri-action@v1` are on their current major. `checkout` and `setup-node` are pinned at v5 — the release that leaves the retired node20 runtime — rather than at latest; the reasons are in a comment in `ci.yml`. Dependabot now raises majors as their own PR. |
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
