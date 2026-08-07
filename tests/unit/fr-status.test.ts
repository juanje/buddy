// tests/unit/fr-status.test.ts — the ✓ in SPEC.md is a fact, not a promise.
//
// The status column was maintained by hand, and by 2026-07-30 eight rows were
// wrong: FR-CONSOL-08/09/10/11, FR-COST-05, FR-NET-03 and FR-REFLECT-06 were
// implemented, covered by passing scenarios, and still unmarked. Nobody
// disobeyed anything — forgetting a checkmark requires no disobedience, which
// is precisely why an instruction could never have caught it.
//
// This is a documentation-coherence test, not a behavioural one: the property
// under test *is* a text property of SPEC.md, so scanning is the subject here
// rather than a weak proxy for it. What it cannot know is whether a scenario
// citing an FR actually exercises it — only that the claim is not unbacked.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SPEC = join(ROOT, "specs", "SPEC.md");
const EVIDENCE_DIRS = [join(ROOT, "specs", "features"), join(ROOT, "tests")];
const EVIDENCE_EXTENSIONS = [".feature", ".ts"];

/** A row whose status says the work was decided against, not deferred to later. */
const NOT_PLANNED = /removed|rejected|deferred|post-MVP/i;

/**
 * Requirements marked done in SPEC.md that no feature file and no test names.
 * This is frozen debt, recorded on 2026-07-30 when the check was introduced:
 * the list may shrink, never grow.
 *
 * They are not all the same problem, and the difference matters when clearing
 * one:
 *
 *   - Covered but unlabelled — `settings.feature` and `git.test.ts` do exercise
 *     the FR-SETTINGS and FR-GIT rows; nothing cites the ID. Cheapest to clear:
 *     add the ID to the test header.
 *   - Verified by evaluation, not by automated test — the FR-BRAIN rows describe
 *     template behaviour judged by running a model against it. A ✓ earned that
 *     way is a different claim and SPEC.md has no notation for it yet.
 *   - Genuinely uncovered — FR-DOCS-00/02 and FR-SESSION-01 turn up nowhere.
 *     FR-REFLECT-07 is the honest case of the same thing and is *not* listed
 *     here, because it was never marked done in the first place.
 *
 * The staleness check below deletes the excuse as soon as it stops applying:
 * once an ID here gains a citation, the suite fails until it is removed.
 */
const UNBACKED_BASELINE = [
  "FR-BRAIN-01",
  "FR-BRAIN-02",
  "FR-BRAIN-03",
  "FR-BRAIN-04",
  "FR-BRAIN-05",
  "FR-BRAIN-06",
  "FR-BRAIN-11",
  "FR-CHAT-05",
  "FR-CHAT-14",
  "FR-DOCS-00",
  "FR-DOCS-02",
  "FR-GIT-02",
  "FR-GIT-03",
  "FR-SESSION-01",
  "FR-SETTINGS-01",
  "FR-SETTINGS-04",
  "FR-SETTINGS-05",
  "FR-SHELL-03",
  "FR-SHELL-04",
  "FR-SHELL-05",
  "FR-SKILL-05",
];

type SpecRow = { id: string; description: string; status: string; done: boolean };

/**
 * Rows look like `| FR-CHAT-01 | Streaming message display | 0 ✓ |`, where the
 * last cell carries the phase and, when the work is finished, a checkmark.
 */
function specRows(): SpecRow[] {
  const rowPattern = /^\|\s*(FR-[A-Z]+-\d+)\s*\|(.*?)\|(.*?)\|\s*$/gm;
  const rows: SpecRow[] = [];
  for (const match of readFileSync(SPEC, "utf8").matchAll(rowPattern)) {
    const status = match[3].trim();
    rows.push({
      id: match[1],
      description: match[2].trim(),
      status,
      done: status.includes("✓"),
    });
  }
  return rows;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (EVIDENCE_EXTENSIONS.includes(extname(entry)) && path !== __filename) {
      // This file names FR-IDs to record that they are *un*covered. Counting
      // itself as evidence would let the baseline below vouch for itself.
      out.push(path);
    }
  }
  return out;
}

/**
 * Collect every FR-ID cited by a feature file or a test. Three notations are in
 * use across the suite and all three are real citations:
 *
 *   FR-CONSOL-08          a single requirement
 *   FR-CONSOL-01/02/04    several, where only the first is a literal ID
 *   FR-INGEST-01..04      a range
 *   FR-HEBB               the whole family, used by a feature file dedicated to it
 *
 * The family form cannot say which member a scenario exercises, so the two
 * sets are kept apart and used asymmetrically:
 *
 *   `specific` — the ID was named. Strong enough to promote a row to done.
 *   `loose`    — the family was named. Enough to not accuse an existing ✓ of
 *                being unbacked, never enough to add one.
 *
 * FR-REFLECT-07 is why. `reflect.test.ts` heads itself `FR-REFLECT`, which
 * would vouch for a watchdog no test actually trips.
 */
function citedIds(families: Map<string, string[]>): { specific: Set<string>; loose: Set<string> } {
  const specific = new Set<string>();
  const loose = new Set<string>();
  for (const file of EVIDENCE_DIRS.flatMap(sourceFiles)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/(FR-[A-Z]+)(-\d+(?:(?:\/|\.\.)\d+)*)?/g)) {
      const family = match[1];
      if (!match[2]) {
        for (const id of families.get(family) ?? []) loose.add(id);
        continue;
      }
      const [first, ...rest] = match[2].slice(1).split(/\/|\.\./);
      specific.add(`${family}-${first}`);
      if (match[2].includes("..")) {
        // A range covers everything between its endpoints.
        for (let n = Number(first) + 1; n <= Number(rest[0]); n += 1) {
          specific.add(`${family}-${String(n).padStart(first.length, "0")}`);
        }
      } else {
        for (const number of rest) specific.add(`${family}-${number}`);
      }
    }
  }
  for (const id of specific) loose.add(id);
  return { specific, loose };
}

/** Every FR-ID grouped by its family prefix, so `FR-HEBB` can expand. */
function familyMembers(rows: SpecRow[]): Map<string, string[]> {
  const families = new Map<string, string[]>();
  for (const row of rows) {
    const family = row.id.replace(/-\d+$/, "");
    families.set(family, [...(families.get(family) ?? []), row.id]);
  }
  return families;
}

describe("SPEC.md FR status", () => {
  it("parses the requirement tables", () => {
    const rows = specRows();
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.filter((row) => row.done).length).toBeGreaterThan(0);
  });

  it("assigns every FR-ID exactly one row", () => {
    const seen = new Map<string, number>();
    for (const row of specRows()) {
      seen.set(row.id, (seen.get(row.id) ?? 0) + 1);
    }
    const duplicated = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicated).toEqual([]);
  });

  it("marks nothing done that no feature or test covers", () => {
    const rows = specRows();
    const { loose } = citedIds(familyMembers(rows));
    const unbacked = rows
      .filter((row) => row.done && !loose.has(row.id))
      .filter((row) => !UNBACKED_BASELINE.includes(row.id))
      .map((row) => `${row.id} (${row.description})`);

    expect(
      unbacked,
      "Marked ✓ in SPEC.md but cited by no feature file and no test. " +
        "Either the work is not finished, or its tests do not name the FR-ID.",
    ).toEqual([]);
  });

  it("keeps the unbacked baseline honest", () => {
    const rows = specRows();
    const { loose } = citedIds(familyMembers(rows));
    const known = new Set(rows.map((row) => row.id));

    const nowCovered = UNBACKED_BASELINE.filter((id) => loose.has(id));
    expect(
      nowCovered,
      "Listed as unbacked debt but now cited by a test. Delete these entries " +
        "from UNBACKED_BASELINE — the list may shrink, never grow.",
    ).toEqual([]);

    const vanished = UNBACKED_BASELINE.filter((id) => !known.has(id));
    expect(vanished, "Listed as unbacked debt but no longer a row in SPEC.md.").toEqual([]);
  });

  it("leaves nothing covered still marked as pending", () => {
    const rows = specRows();
    const { specific } = citedIds(familyMembers(rows));
    const stale = rows
      .filter((row) => !row.done && !NOT_PLANNED.test(row.status) && specific.has(row.id))
      .map((row) => `${row.id} (${row.description})`);

    expect(
      stale,
      "Covered by a feature file or a test but missing its ✓ in SPEC.md. " +
        "Add the checkmark, or explain in the status column why the work does not count as done.",
    ).toEqual([]);
  });
});
