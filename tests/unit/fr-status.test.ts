// tests/unit/fr-status.test.ts — every FR-ID has exactly one row in SPEC.md.
//
// What is built is not SPEC.md's to say: the progress record holds it, written
// only by `npm run progress -- check` (NFR-TEST-03). What SPEC.md must still
// get right is that an ID names one requirement, not two.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SPEC = join(ROOT, "specs", "SPEC.md");

/** Rows look like `| FR-CHAT-01 | Streaming message display | 0 |`. */
function specRowIds(): string[] {
  const rowPattern = /^\|\s*(FR-[A-Z]+-\d+)\s*\|(.*?)\|(.*?)\|\s*$/gm;
  return [...readFileSync(SPEC, "utf8").matchAll(rowPattern)].map((match) => match[1]);
}

describe("SPEC.md FR rows", () => {
  it("parses the requirement tables", () => {
    expect(specRowIds().length).toBeGreaterThan(100);
  });

  it("assigns every FR-ID exactly one row", () => {
    const seen = new Map<string, number>();
    for (const id of specRowIds()) {
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    const duplicated = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicated).toEqual([]);
  });
});
