// tests/unit/reflect-observations.test.ts — FR-REFLECT-08.
//
// `process-conversation.md` is loaded in two places with opposite capabilities:
//
//   skill-tools.ts    → registered as the `process_conversation` tool, inside a
//                       chat session that has read/write/edit
//   reflect-prompts.ts → loaded for the reflect fork, which is created with
//                       `noTools: "all"` and told "You have no tools"
//
// Steps 3 and 4 of the skill ask the model to verify where captures landed and
// to "Write to `agent_brain/observations.md`". In the fork those are
// unexecutable by construction, and the skill never says so.
//
// What the model does instead is the interesting part. On 2026-07-29 one
// reflect emitted an `### Observations` section — the only way it could comply
// — which landed in the daily log where nothing reads it. Another gave up and
// logged the skill's own instruction ("the importance of the future reader
// test") as though it were a lesson from the conversation.
//
// The fix follows the app's own division of labour: the model judges, the
// worker acts. Reflect emits the section; the worker moves it to
// observations.md. This is a design bug, not a local-model one — a commercial
// model has no more tools in that fork than a 12B does.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { extractObservationsSection } from "../../backends/reflect-prompts";
import { appendReflectObservations } from "../../backends/reflect";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reflect-obs-"));
  mkdirSync(join(root, "agent_brain"), { recursive: true });
  writeFileSync(
    join(root, "agent_brain", "observations.md"),
    "---\nsummary: System observations\ncreated: 2026-07-01\n---\n\n# System observations\n\n- **2026-07-13:** An older note. (seen: 1)\n",
    "utf8",
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const WITH_OBS = `### Context

The user reviewed a draft.

### Observations

- **Rule candidate:** the user wants internal paths rendered as links.
- **Concept candidate:** exploration and exploitation are context-dependent.

### Open threads

The article is still unfinished.
`;

describe("extractObservationsSection", () => {
  it("separates the observations from the log body", () => {
    const { body, observations } = extractObservationsSection(WITH_OBS);

    expect(observations).toContain("Rule candidate");
    expect(observations).toContain("Concept candidate");
    // The section is removed from what goes into the daily log: it belongs in
    // observations.md, and duplicating it would put the same text in two files
    // that are both injected into future sessions.
    expect(body).not.toContain("### Observations");
    expect(body).toContain("### Context");
    expect(body).toContain("### Open threads");
  });

  it("leaves output without the section untouched", () => {
    const plain = "### Context\n\nNothing notable.\n";
    const { body, observations } = extractObservationsSection(plain);
    expect(body).toBe(plain);
    expect(observations).toBeUndefined();
  });

  it("handles the section appearing last", () => {
    const { body, observations } = extractObservationsSection(
      "### Context\n\nSomething.\n\n### Observations\n\n- A signal.\n",
    );
    expect(observations).toContain("A signal");
    expect(body.trim()).toBe("### Context\n\nSomething.");
  });

  it("ignores an empty section rather than filing nothing", () => {
    const { observations } = extractObservationsSection(
      "### Context\n\nSomething.\n\n### Observations\n\n\n### Open threads\n\nx\n",
    );
    expect(observations).toBeUndefined();
  });
});

describe("appendReflectObservations", () => {
  it("files observations under the date, preserving what is there", () => {
    appendReflectObservations(root, "2026-07-29", "- **Rule candidate:** use links.");

    const content = readFileSync(join(root, "agent_brain", "observations.md"), "utf8");
    expect(content).toContain("- **2026-07-29:** **Rule candidate:** use links. (seen: 1)");
    expect(content).toContain("An older note."); // nothing lost
    expect(content).toContain("summary: System observations"); // frontmatter intact
  });

  it("counts the observation, or promotion can never reach it", () => {
    // ripe-observations.ts parses `(seen: N)` and consolidation acts at 2+.
    // Without the counter the entry is inert: filed, never promoted.
    appendReflectObservations(root, "2026-07-29", "- A signal.");
    expect(readFileSync(join(root, "agent_brain", "observations.md"), "utf8")).toMatch(
      /\(seen: 1\)/,
    );
  });

  it("strips whichever bullet marker the model used", () => {
    // The 2026-07-29 run emitted `*   ` and produced
    // "- **2026-07-29:** *   **Model/Tool interaction:** …".
    appendReflectObservations(root, "2026-07-29", "*   **Model/Tool:** edit is strict.");
    const content = readFileSync(join(root, "agent_brain", "observations.md"), "utf8");
    expect(content).toContain("- **2026-07-29:** **Model/Tool:** edit is strict. (seen: 1)");
    expect(content).not.toContain("*   **Model/Tool");
  });

  it("files each bullet as its own observation", () => {
    // They are counted and promoted independently; merging them into one
    // paragraph would make two signals share a single counter.
    appendReflectObservations(root, "2026-07-29", "- First signal.\n- Second signal.");
    const content = readFileSync(join(root, "agent_brain", "observations.md"), "utf8");
    expect(content).toContain("- **2026-07-29:** First signal. (seen: 1)");
    expect(content).toContain("- **2026-07-29:** Second signal. (seen: 1)");
  });

  it("keeps a wrapped observation as one entry", () => {
    appendReflectObservations(root, "2026-07-29", "- A long signal\n  that wrapped across lines.");
    expect(readFileSync(join(root, "agent_brain", "observations.md"), "utf8")).toContain(
      "- **2026-07-29:** A long signal that wrapped across lines. (seen: 1)",
    );
  });

  it("does not touch the file when there is nothing to file", () => {
    const before = readFileSync(join(root, "agent_brain", "observations.md"), "utf8");
    appendReflectObservations(root, "2026-07-29", undefined);
    expect(readFileSync(join(root, "agent_brain", "observations.md"), "utf8")).toBe(before);
  });

  it("creates the file when the instance has none", () => {
    rmSync(join(root, "agent_brain", "observations.md"));
    appendReflectObservations(root, "2026-07-29", "- **Skill candidate:** something.");
    expect(readFileSync(join(root, "agent_brain", "observations.md"), "utf8")).toContain(
      "something",
    );
  });
});
