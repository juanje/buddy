// tests/unit/data-registry.test.ts — FR-DATA-01

import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateToolCall } from "../../backends/permissions";
import { isFileOpProtected } from "../../backends/file-tools";
import { parseDataRegistryDocument } from "../../shared/data/registry";

describe("parseDataRegistryDocument", () => {
  it("keeps valid entries when another entry is broken", () => {
    const doc = `
## alpha

\`\`\`data
kind: series
key: id
columns:
  id: string
\`\`\`

## beta

\`\`\`data
kind: series
key: id
columns: [bad]
\`\`\`

## gamma

\`\`\`data
kind: series
key: id
columns:
  id: string
\`\`\`
`;
    const out = parseDataRegistryDocument(doc);
    expect(out.entries.map((e) => e.name).sort()).toEqual(["alpha", "gamma"]);
    expect(out.errors.some((e) => e.name === "beta")).toBe(true);
  });
});

describe("data registry protection", () => {
  const HOME = mkdtempSync(join(tmpdir(), "data-reg-perm-"));
  const AB = join(HOME, "buddy");
  mkdirSync(join(AB, "user", "data"), { recursive: true });

  const evaluate = (tool: string, args: unknown) =>
    evaluateToolCall(tool, args, AB, HOME, join(HOME, ".buddy"));

  it("rejects delete of user/data/index.md", () => {
    expect(isFileOpProtected("user/data/index.md")).toBe(true);
  });

  it("rejects move source user/data/index.md", () => {
    expect(isFileOpProtected("user/data/index.md")).toBe(true);
  });

  it("denies write to user/data/index.md", () => {
    expect(evaluate("write", { path: `${AB}/user/data/index.md` })).toEqual({
      action: "deny",
      reason: "Use data(action='define') to change the data registry.",
    });
  });

  it("denies edit of user/data/index.md", () => {
    expect(evaluate("edit", { path: "user/data/index.md" })).toEqual({
      action: "deny",
      reason: "Use data(action='define') to change the data registry.",
    });
  });

  it("denies copy into user/data/index.md", () => {
    expect(
      evaluate("copy_file", {
        source: "user/notes/a.md",
        destination: "user/data/index.md",
      }),
    ).toEqual({
      action: "deny",
      reason: "Use data(action='define') to change the data registry.",
    });
  });
});
