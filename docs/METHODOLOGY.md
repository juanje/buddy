# Development Methodology: Outside-In (Spec → BDD → TDD)

Buddy ships feature by feature. The procedure for building one FR is in
`AGENTS.md`; this file explains the progress record that says what is built.

## The cycle

For each feature:

1. **Contract** — the FR in `specs/SPEC.md` (outcome, errors and why) and its
   scenarios in `specs/features/`, tagged `@FR-xxx`, committed by the person
   as `spec(…): FR-xxx`.
2. **BDD red** — step definitions in `tests/steps/`, committed alone as
   `test(…): FR-xxx`, with the scenarios running and failing.
3. **TDD** — one failing unit test, committed alone as `test(…): FR-xxx`, then
   the code that makes it pass as `feat(…)` or `fix(…): FR-xxx`; repeat until
   the scenarios pass.
4. **Check** — `npm run progress -- check FR-xxx` verifies the commits and the
   quality gate and records the FR as built.

---

## The progress record

`specs/progress.json` says what is built. Nothing writes to it but the check,
and nobody edits it by hand.

```bash
npm run progress -- status          # every FR with a contract or a record, and its state
npm run progress -- show FR-xxx     # one FR: its state and its contract, test and code commits
npm run progress -- check FR-xxx    # verify FR-xxx and record it as built
```

`status` and `show` only read. Their states:

| State | Meaning |
|-------|---------|
| in progress | a `spec(…): FR-xxx` commit exists and no check has verified the FR |
| built at `<commit>` on `<date>` | a check verified the FR at that commit |
| changed since its verification | a `spec(…): FR-xxx` commit came after the verified commit |
| built, recorded before the checks | the FR was marked done before the check existed (`recordedBeforeChecks`) |

### What the check verifies

`check` needs a clean working tree, so what it verifies is a commit. It
refuses, and records nothing, unless the FR's commits show:

- a `spec(…): FR-xxx` contract commit;
- at least one `test(…): FR-xxx` commit, and no `feat`/`fix` commit for the FR
  before the first one;
- no `test` commit that changes `backends/`, `src/` or `shared/`;
- each scenario a contract commit added fails first at the commit before the
  first `feat`/`fix` commit that follows it;
- each `test` commit's unit tests fail first at that commit, and its step
  definitions make at least one of the FR's scenarios fail first;
- each of those tests and scenarios passes at the last commit where it still
  exists: HEAD, or the commit just before the one that replaced or removed it;
- the full quality gate passes now: `npx tsc --noEmit`, `npx vite build`,
  `npm test`.

A test **fails first** when, at that commit, it ran and failed on an assertion
or on an error thrown while it ran, or its file failed to load because a
project module or export it imports did not exist yet. An undefined, pending
or ambiguous step, a skipped test, and a file that fails to load for its own
syntax or a missing package do not fail first. A test or scenario that
passes at its commit counts as failing first only when that commit's message
has a trailer line `Mutant: <its name> — <what was broken>`, one per test or
scenario it proves. The check still runs every test of the commit; a trailer
exempts only the test or scenario it names. For a unit test, the name is
vitest's full name: the `describe` titles and the test title, joined by
spaces.

Each example row of a Scenario Outline is a scenario of its own, named by its
outline and its cells joined by ` | `, such as
`Refused <case> | ../specs | a path`. A `Mutant:` trailer may name one row
that way, or the outline, which covers all its rows.

The check runs past commits in temporary git worktrees that share the
project's `node_modules`. It stops at the first stage that fails (commit
order, then the runs at past commits, then the gate) and lists each problem
with the commit it is in and how to make it hold.

After a check succeeds, commit `specs/progress.json`.

---

## Traceability

| Artefact | Purpose |
|----------|---------|
| `specs/SPEC.md` | The person's contract: every FR, what and why |
| `specs/features/*.feature` | Acceptance criteria (Given/When/Then), tagged `@FR-xxx` |
| `specs/progress.json` | What is built, written only by the check |
| `tests/steps/` | Executable step definitions |
| `tests/unit/` | Inner-loop TDD for deterministic logic |
