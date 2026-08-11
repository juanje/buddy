// tests/unit/hebbian-bootstrap.test.ts — FR-HEBB-05.
//
// The Hebbian layer had a closed loop that made it inert for anything Buddy
// created itself:
//
//   consolidation.md:295  "you never write access_count or last_accessed
//                          fields. The worker updates those automatically"
//   hebbian.ts:48         if (!("access_count" in fields)) return null;
//
// The model is forbidden from creating the fields; the worker only updates
// fields that already exist. So a concept the agent distils is born without
// them and can never acquire them — it scores zero forever, and every
// consolidation demotes it.
//
// Found on an instance where all 14 files Buddy had created lacked the fields
// while every imported file had them, so promotion could only ever favour
// content from the previous tool. On a fresh install nothing has them at all,
// which means promotion and demotion by use — the whole point of the layer —
// never happens.
//
// The fix is deliberately the repairing kind: the fields are created on first
// read, so existing brains heal as they are used, with no migration.

import { describe, expect, it } from "vitest";

import { updateAccessFrontmatter } from "../../backends/hebbian";

const TODAY = "2026-07-28";

/** What a consolidation actually writes when it creates a concept. */
const AGENT_CREATED = `---
summary: "Routing external and local markdown links in desktop chat"
created: 2026-07-28
---

# Local link routing
`;

const WITH_HEBBIAN = `---
summary: An imported file
created: 2026-05-08
last_accessed: 2026-07-25
access_count: 4
---

# Body
`;

function fieldsOf(content: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---/.exec(content)![1];
  return Object.fromEntries(
    block.split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
}

describe("updateAccessFrontmatter", () => {
  it("increments a file that already tracks access", () => {
    const out = updateAccessFrontmatter(WITH_HEBBIAN, TODAY)!;
    expect(fieldsOf(out).access_count).toBe("5");
    expect(fieldsOf(out).last_accessed).toBe(TODAY);
  });

  it("bootstraps a file the agent created without the fields", () => {
    // This is the case that was returning null and doing nothing.
    const out = updateAccessFrontmatter(AGENT_CREATED, TODAY);
    expect(out).not.toBeNull();
    expect(fieldsOf(out!).access_count).toBe("1");
    expect(fieldsOf(out!).last_accessed).toBe(TODAY);
  });

  it("counts the read that bootstraps it, rather than starting at zero", () => {
    // The file is being read right now; that read is worth exactly as much as
    // any other. Starting at 0 would discard it.
    expect(fieldsOf(updateAccessFrontmatter(AGENT_CREATED, TODAY)!).access_count).toBe("1");
  });

  it("preserves the existing keys and the body untouched", () => {
    const out = updateAccessFrontmatter(AGENT_CREATED, TODAY)!;
    const fields = fieldsOf(out);
    expect(fields.summary).toBe('"Routing external and local markdown links in desktop chat"');
    expect(fields.created).toBe("2026-07-28");
    expect(out).toContain("# Local link routing");
  });

  it("does not produce a second frontmatter block", () => {
    // The failure mode NFR-FORMAT-01 exists for: appending rather than merging.
    const out = updateAccessFrontmatter(AGENT_CREATED, TODAY)!;
    expect(out.match(/^---$/gm)?.length).toBe(2);
  });

  it("accumulates across successive reads", () => {
    let content = AGENT_CREATED;
    for (const day of ["2026-07-28", "2026-07-29", "2026-07-30"]) {
      content = updateAccessFrontmatter(content, day)!;
    }
    expect(fieldsOf(content).access_count).toBe("3");
    expect(fieldsOf(content).last_accessed).toBe("2026-07-30");
  });

  it("updates CRLF frontmatter via the shared matcher (review D6)", () => {
    const crlf = AGENT_CREATED.replaceAll("\n", "\r\n");
    const out = updateAccessFrontmatter(crlf, TODAY)!;
    expect(fieldsOf(out.replaceAll("\r\n", "\n")).access_count).toBe("1");
    expect(out).toContain("# Local link routing");
  });

  it("leaves a file with no frontmatter alone", () => {
    // Adding a whole block needs a `summary`, which is a judgment call and
    // belongs to consolidation. The linter reports these separately.
    expect(updateAccessFrontmatter("# Just a heading\n", TODAY)).toBeNull();
  });

  it("repairs a malformed count rather than propagating it", () => {
    const broken = `---\ncreated: 2026-07-01\naccess_count: not-a-number\n---\n\n# Body\n`;
    expect(fieldsOf(updateAccessFrontmatter(broken, TODAY)!).access_count).toBe("1");
  });

  it("updates CRLF frontmatter via the shared matcher (review D6)", () => {
    const crlf = AGENT_CREATED.replaceAll("\n", "\r\n");
    const out = updateAccessFrontmatter(crlf, TODAY)!;
    expect(fieldsOf(out.replaceAll("\r\n", "\n")).access_count).toBe("1");
    expect(out).toContain("# Local link routing");
  });
});
