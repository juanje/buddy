# Development Methodology: Outside-In (Spec → BDD → TDD)

Buddy ships feature by feature. Each in-flight FR is tracked in
`specs/progress.json` and advanced only through `scripts/progress.ts`.
Done features leave the file; git history retains them.

## The cycle

For each feature:

1. **Spec review** — FR defined or verified in `specs/SPEC.md` (WHAT and WHY;
   no acceptance criteria in SPEC.md).
2. **BDD red** — Write `.feature` scenarios tagged `@FR-xxx` in
   `specs/features/`, step definitions in `tests/steps/`, run
   `npm run test:bdd` and confirm RED (steps execute and fail — "undefined
   step" is not red).
3. **Implementing** — TDD inner loop: one failing unit test → minimum code →
   green → refactor → repeat until the BDD scenario passes.
4. **BDD green** — Full quality gate passes:
   `npx tsc --noEmit && npx vite build && npm test`.
5. **Done** — `npx tsx scripts/progress.ts done FR-xxx` (CLI-enforced).

Outer loop steps in `progress.json`:

```
spec_review → bdd_red → implementing → bdd_green → done
```

The TDD red/green/refactor loop lives inside **implementing** — enforced by
`CLAUDE.md`, not by separate JSON states.

---

## Progress CLI

Machine-readable state lives in `specs/progress.json`. **Always use the CLI**
to read and write it — never edit the JSON directly.

```bash
npx tsx scripts/progress.ts current              # What to work on now
npx tsx scripts/progress.ts status               # All tracked features
npx tsx scripts/progress.ts show FR-xxx          # Detail for one feature
npx tsx scripts/progress.ts advance FR-xxx       # Next cycle_step
npx tsx scripts/progress.ts scenario pass FR-xxx "Scenario name"
npx tsx scripts/progress.ts scenario fail FR-xxx "Scenario name"
npx tsx scripts/progress.ts units FR-xxx "Scenario name" 3
npx tsx scripts/progress.ts focus FR-xxx         # Switch focus
npx tsx scripts/progress.ts add FR-xxx "Title"   # Add feature
npx tsx scripts/progress.ts done FR-xxx          # Mark done (guarded)
```

### State transitions

| Field | Values | Notes |
|-------|--------|-------|
| `status` | `pending`, `in_progress`, `blocked`, `deferred`, `done` | `advance` sets `pending` → `in_progress` |
| `cycle_step` | `spec_review` → `bdd_red` → `implementing` → `bdd_green` → `done` | One-way; no skipping |
| `scenarios[].bdd` | `pending` → `fail` → `pass` | Updated via `scenario` command |
| `scenarios[].unit_tests` | non-negative integer | Updated via `units` command |

### Validations

**`advance`:**

- One-way along `CYCLE_STEPS`; cannot skip.
- `spec_review → bdd_red`: FR-ID must appear in `specs/SPEC.md`.

**`done`:**

- At least one scenario.
- Every scenario: `bdd === "pass"` and `unit_tests >= 1`.
- Clears `current_focus` if this feature was focused.

---

## Consistency gate

`tests/unit/progress-consistency.test.ts` runs as part of `npm test`. It
asserts:

1. `current_focus` points to a feature with `status: "in_progress"` (or is null)
2. `status: "done"` requires all scenarios `bdd: "pass"` with `unit_tests >= 1`
3. No `in_progress` feature has `cycle_step: "done"` simultaneously
4. Features past `spec_review` have `@FR-xxx` in some `.feature` file

Complementary: `tests/unit/fr-status.test.ts` verifies SPEC.md ✓ marks against
feature files and tests.

---

## Traceability

| Artefact | Purpose |
|----------|---------|
| `specs/SPEC.md` | Catalog of all FRs; ✓ marks for shipped work |
| `specs/features/*.feature` | Acceptance criteria (Given/When/Then), tagged `@FR-xxx` |
| `specs/progress.json` | In-flight work only — WHERE you are in the cycle |
| `tests/steps/` | Executable step definitions |
| `tests/unit/` | Inner-loop TDD for deterministic logic |

### Example

**SPEC.md:**

```markdown
### FR-PERM-06b: Allow always only for outside reads
Hide persistent permission options on write prompts; reads may use Allow always.
```

**specs/features/permission.feature:**

```gherkin
@FR-PERM-06b
Feature: Persistent permission options

  Scenario: Write prompt does not offer Allow always
    Given a write permission request for a path outside the workspace
    When the permission card is shown
    Then the Allow always option is not visible
```

---

## Rules

1. **Start every session** with `npx tsx scripts/progress.ts current` (or
   `status` / `focus` per `CLAUDE.md` session-start tree).
2. **Follow the cycle strictly.** No implementation before a failing test.
3. **One feature at a time.** Finish current before starting next.
4. **BDD scenarios are the definition of done** for a feature cycle.
5. **Update progress only through the CLI** after every step transition.
6. **Don't put acceptance criteria in SPEC.md.** They belong in `.feature` files.
7. **Don't put prose in progress.json.** Pure state only (`note` is optional,
   one line max).
8. **The quality gate is part of bdd_green**, not a separate JSON step.
