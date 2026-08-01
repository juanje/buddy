# buddy

A native desktop app (Tauri + Svelte + a TypeScript worker running the Pi SDK)
that gives non-technical users a personal assistant with persistent, file-based
memory. Built feature by feature with BDD + TDD.

**This file says how to work here. It does not say what is currently being
worked on** — `specs/PROGRESS.md` owns that. A priority written in two places
outlives its correction in one of them, which has happened here. Read PROGRESS
before proposing work; nothing in this file declares what comes next.

## Process (strict, every feature)

1. Read `specs/PROGRESS.md` — current focus and open work
2. Read the FR's acceptance criteria in `specs/SPEC.md`
3. Write or verify the `.feature` file in `specs/features/` (Gherkin)
4. Write step definitions in `tests/steps/` that make it executable
5. Implement — TDD: red → green → refactor
6. All tests pass before the next feature
7. Update `PROGRESS.md`: what closed leaves the file, what opened enters it
8. Commit referencing the FR-ID

## Rules

- Never implement without a test first. Feature file → step definitions → code.
  Why: prevents drift between spec and implementation; the test IS the contract.
- One feature at a time. Do not start the next FR until the current one is green.
  Why: dependencies between features mean a broken FR-01 undermines FR-02.
- The spec is the source of truth. If you think the spec is wrong, stop and ask —
  do not silently diverge.
  Why: the spec records deliberate design decisions; changing code unilaterally
  loses the reasoning without anyone noticing.
- Commit after each feature or logical sub-step, referencing the FR-ID.
  Why: git history is the project's memory, and traceability runs commit →
  requirement → design decision.
- Unit tests for deterministic logic (permissions, parsers, scheduler counters).
  Feature tests for user-facing behaviour (chat, wizard, ingest).
  Why: unit tests are fast and precise for pure functions; feature tests validate
  the experience end to end.
- All code, comments and documentation in English. Prompts and agent-facing docs
  too, and there without foreign-language examples: an English instruction
  illustrated with "muéstrame" is a strong signal to the model and risks
  overfitting to the phrase. Spanish is fine as *test data* in feature files,
  where the point is to exercise what a user really writes.

## What repeated failures have taught this project

These are not style preferences. Each one cost a defect that shipped.

- **Test the composition, not just the component.** A function can be correct
  and never called. The Hebbian layer passed its unit tests for months while
  recording nothing, because no test drove the real event flow. If a fix is "the
  call was missing", a test of the callee cannot catch its regression.
- **A rule only governs what a rule can reach.** Several defects were already
  forbidden in a prompt or in `AGENTS.md`. The instruction did not fail — it did
  not apply, because the failure occurred without anyone disobeying. When a
  failure needs no disobedience, enforcement belongs in code.
- **A test asserting something does *not* happen deserves suspicion.** Six tests
  in one stretch had to be rewritten because they had pinned a defect in place
  as though it were a requirement. Ask whether it describes a decision or a
  limitation.
- **Reintroduce the bug to check the test.** A test written after a fix often
  passes with the fix removed. Verify it fails.
- **Prefer behavioural tests to source-text scans.** A scan checking that a call
  exists breaks on refactors with the behaviour intact, and passes when the call
  is present but unreachable.
- **"Reported success" is not evidence.** Duration, side effects and the actual
  artefact are. A consolidation that "succeeded" in 22 ms did nothing.

## Quality gate (all three, before every commit)

```
npx tsc --noEmit      # types + dead imports/locals (noUnusedLocals)
npx vite build        # tsc does NOT check .svelte — this is what catches
                      # broken components and orphaned CSS
npm test              # vitest + cucumber
```

Run from the repository root, never from an editor workspace: BDD and ESM
resolution need it as cwd. CI runs the same three, and a release tag cannot
publish without them.

`vite build` is not optional. It was added after a refactor left orphaned CSS
that `tsc` reported as clean. And note what it still does **not** check: a
`.svelte` file referencing a CSS custom property nobody defines builds fine,
because `var(--typo, #hex)` renders the fallback —
`tests/unit/design-tokens.test.ts` covers that (NFR-ACC-04).

`tsc` also runs `noUnusedLocals`/`noUnusedParameters`. Prefix a deliberately
unused parameter with `_` rather than turning the flag off. It does not report
an exported function nobody imports, so a refactor can leave dead exports behind
with the gate green.

## Commit convention

```
feat(scope): FR-ID description
test(scope): FR-ID feature/step definitions
fix(scope): FR-ID fix description
docs: update spec/docs
chore: tooling, deps, config
```

## Traps

Not a description of the architecture — `docs/app-spec-tauri.md` has that.
These are the things that bite, and that reading the code does not reveal until
something is already broken.

- **The repo tree does not exist inside the compiled binary.** Anything reading
  `templates/` or `bundled/` from disk works in dev and fails when packaged.
  That is what `backends/embedded-assets.generated.ts` is for. It is committed
  *and* regenerated by the build; `tests/unit/embedded-assets-sync.test.ts`
  fails when the committed copy no longer matches the repo.
- **`tool_execution_end` carries no `args`** — only `toolCallId`, `toolName`,
  `result`, `isError`. Anything needing the path must pair it with the matching
  `tool_execution_start`. `SessionTracker.recordEvent` already does; do not keep
  a second map that can disagree with it.
- **`createAgentSession` takes two tool lists that must agree.** `tools` is an
  allowlist of names, applied to `customTools` as well, so a tool present in one
  and missing from the other is silently never offered — indistinguishable from
  a model choosing not to call it. `buildAgentToolset` derives both from one
  array; keep it that way.
- **A path constant is not a containment check.** Naming a directory says
  nothing about where a string points. `backends/containment.ts` is the only
  authority, and it resolves symlinks (NFR-SEC-15/16).

## Where things are

| Need | File |
|------|------|
| What is open, what is next | `specs/PROGRESS.md` |
| An FR's acceptance criteria | `specs/SPEC.md` |
| The test you must make pass | `specs/features/*.feature` |
| The live frontend↔worker contract | `shared/api.ts` |
| Operational and security constants | `shared/defaults.ts` |
| The buddy directory layout | `shared/brain-paths.ts` |
| Whether a path may be touched | `backends/containment.ts` |
| Why a decision was made | `docs/app-design-principles.md` |
| Architecture and Pi SDK usage | `docs/app-spec-tauri.md` |
| Cutting a release | `docs/releases/README.md` |
| Dependencies and versions | `package.json` |
