// tests/unit/brain-damage.test.ts — NFR-FORMAT-01 enforcement, FR-CONSOL-13.
//
// The brain is written by the model, through `edit` and `write`. Nothing
// checked the result. On 2026-07-28 a depth-1 consolidation appended a second
// `---` block to four concept files rather than merging into the existing one,
// inventing a `created` date six days earlier than the file itself — and the
// run was recorded as a success.
//
// The linter existed. It ran *before* consolidation and only looked for
// frontmatter that was **missing**, so damage of this shape was invisible to it
// in both directions: it could not see the corruption, and it never looked
// afterwards anyway.

import { describe, expect, it } from "vitest";

import { frontmatterProblem, type BrainHealthReport } from "../../backends/brain-health";
import { assertNoNewBrainDamage, BrainDamagedError } from "../../backends/consolidation-runner";

/** Verbatim from agent_brain/concepts/local-link-routing.md after the incident. */
const SECOND_BLOCK = `---
summary: "Desktop chat must route external URLs and local markdown links through different resolution paths"
created: 2026-07-28
---

---
summary: "Routing external and local markdown links in desktop chat"
created: 2026-07-22
---

# Local link routing in desktop chat
`;

/** Verbatim shape from agent_brain/identity/health.md. */
const DUPLICATE_KEY = `---
last_accessed: 2026-03-31
access_count: 1
created: 2026-03-27
summary: Health profile
created: 2026-03-31
---

# User health profile
`;

const HEALTHY = `---
summary: A well-formed file
created: 2026-07-01
last_accessed: 2026-07-28
access_count: 3
---

# Body
`;

describe("frontmatterProblem", () => {
  it("passes a well-formed file", () => {
    expect(frontmatterProblem(HEALTHY)).toBeNull();
  });

  it("catches the stacked second block", () => {
    expect(frontmatterProblem(SECOND_BLOCK)).toMatch(/second frontmatter block/i);
  });

  it("catches a key repeated inside one block, naming it", () => {
    expect(frontmatterProblem(DUPLICATE_KEY)).toMatch(/created/);
  });

  it("catches an unterminated block", () => {
    expect(frontmatterProblem("---\nsummary: x\n\n# Body\n")).toMatch(/not terminated/i);
  });

  it("says nothing about a file with no frontmatter", () => {
    // Absence is missingFrontmatter's job. Reporting it twice would make the
    // consolidation prompt argue with itself about what to do.
    expect(frontmatterProblem("# Just a heading\n")).toBeNull();
  });

  it("does not mistake a horizontal rule in the body for a second block", () => {
    // This is what made the first survey of the instance report 90 false
    // positives: articles use `---` as a separator.
    expect(frontmatterProblem(`${HEALTHY}\nSome prose.\n\n---\n\nMore prose.\n`)).toBeNull();
  });
});

describe("assertNoNewBrainDamage", () => {
  const report = (
    malformed: Array<{ path: string; problem: string }> = [],
  ): BrainHealthReport => ({
    missingFrontmatter: [],
    malformedFrontmatter: malformed,
    missingCoreFiles: [],
    missingIndexes: [],
    oversizedFiles: [],
  });

  it("allows a run that broke nothing", () => {
    expect(() => assertNoNewBrainDamage(report(), report())).not.toThrow();
  });

  it("fails a run that introduced damage, naming the file and the problem", () => {
    expect(() =>
      assertNoNewBrainDamage(
        report(),
        report([{ path: "agent_brain/concepts/x.md", problem: "a second frontmatter block" }]),
      ),
    ).toThrow(BrainDamagedError);

    expect(() =>
      assertNoNewBrainDamage(
        report(),
        report([{ path: "agent_brain/concepts/x.md", problem: "a second frontmatter block" }]),
      ),
    ).toThrow(/concepts\/x\.md/);
  });

  it("tolerates damage that was already there", () => {
    // An instance carrying inherited corruption would otherwise fail every
    // consolidation forever, and the failure would say nothing about the run
    // that just ran. Not hypothetical: an instance imported from another tool
    // arrives with damage no consolidation of ours caused.
    const inherited = [{ path: "agent_brain/projects/old.md", problem: "duplicated key: created" }];
    expect(() => assertNoNewBrainDamage(report(inherited), report(inherited))).not.toThrow();
  });

  it("still fails when a run adds damage on top of inherited damage", () => {
    const inherited = [{ path: "agent_brain/projects/old.md", problem: "duplicated key: created" }];
    expect(() =>
      assertNoNewBrainDamage(
        report(inherited),
        report([...inherited, { path: "agent_brain/concepts/new.md", problem: "second block" }]),
      ),
    ).toThrow(/concepts\/new\.md/);
  });

  it("does not credit a run for repairing an old file", () => {
    // Repair is welcome but not what this guard measures; it must stay silent
    // rather than reporting anything, so a repairing run is simply not failed.
    const inherited = [{ path: "agent_brain/projects/old.md", problem: "duplicated key: created" }];
    expect(() => assertNoNewBrainDamage(report(inherited), report())).not.toThrow();
  });
});
