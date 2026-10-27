// tests/unit/progress-record.test.ts — NFR-TEST-03 the record holds what a check wrote.
//
// Only `npm run progress -- check` writes specs/progress.json, but nothing in
// the file proves that. This is the net against a hand edit that runs whatever
// tool made it: every entry must name an FR that SPEC.md has a row for, every
// verification a commit in this history, and SPEC.md must not carry built
// marks of its own.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readProgressRecord } from "../../scripts/progress";

const ROOT = join(__dirname, "..", "..");
const SPEC = readFileSync(join(ROOT, "specs", "SPEC.md"), "utf8");
const FR_ROW = /^\|\s*(N?FR-[A-Z]+(?:-[A-Z]+)*-\d+[a-z]?)\s*\|/;

function specRowIds(): Set<string> {
  const ids = new Set<string>();
  for (const line of SPEC.split("\n")) {
    const id = FR_ROW.exec(line)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

function isCommitInHistory(sha: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("the progress record", () => {
  const record = readProgressRecord(ROOT);

  it("names only FRs that SPEC.md has a row for", () => {
    const rows = specRowIds();
    const entries = [...Object.keys(record.built), ...record.recordedBeforeChecks];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter((id) => !rows.has(id))).toEqual([]);
  });

  it("names, for each verified FR, a commit in this history", () => {
    const unknown = Object.entries(record.built)
      .filter(([, { commit }]) => !/^[0-9a-f]{40}$/.test(commit) || !isCommitInHistory(commit))
      .map(([id, { commit }]) => `${id} at ${commit}`);
    expect(unknown).toEqual([]);
  });
});

describe("SPEC.md", () => {
  it("holds no built marks in its FR tables or FR headings", () => {
    const marked = SPEC.split("\n").filter((line) => {
      if (/^\*\*N?FR-\S+ — .*\*\*.*✓/.test(line)) return true;
      if (!FR_ROW.test(line)) return false;
      // The ID cell and, in tables with a status column, the last cell are the
      // ones that carried ✓. A requirement's own text may mention the mark.
      const cells = line.split("|").slice(1, -1);
      return cells[0].includes("✓") || (cells.length >= 3 && cells[cells.length - 1].includes("✓"));
    });
    expect(marked).toEqual([]);
  });
});
