// tests/unit/session-creation-guard.test.ts — FR-CONSOL-10 / NFR-SEC-14 guard.
//
// The July 2026 defect was that `consolidation-runner.ts` created a session with
// the full file tool set and never installed the permission hook. No behavioural
// test catches that: the gate module works, the policy works, and every scenario
// passes — because nothing asserts the two were ever connected. Verified by
// reintroducing the bug, at which point 9 unit tests and 213 BDD scenarios still
// passed.
//
// A missing call cannot be observed by exercising the thing that was not called.
// So this checks the call sites themselves: every production session must either
// install the gate or have no tools to gate. It is the same shape as NFR-SEC-13
// (a tool with an undeclared path argument fails the suite), and it is a
// stopgap — NFR-SEC-14's factory is what would make the mistake unrepresentable.

import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  createMaintenanceSession,
  type MaintenanceAgentSession,
} from "../../backends/consolidation-runner";

const BACKENDS_DIR = join(import.meta.dirname, "..", "..", "backends");

/** Evidence that a session's tool calls pass through the permission layer. */
const GATE_MARKERS = ["installMaintenanceGate", "createPermissionGate", "beforeToolCall"];
/** Evidence that a session has no tools to gate in the first place. */
const NO_TOOLS_MARKERS = ['noTools: "all"', "noTools:"];

function backendSources(): Array<{ file: string; source: string }> {
  return readdirSync(BACKENDS_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".generated.ts"))
    .map((file) => ({ file, source: readFileSync(join(BACKENDS_DIR, file), "utf8") }));
}

describe("session creation call sites", () => {
  const creators = backendSources().filter(({ source }) => source.includes("createAgentSession({"));

  it("finds the known session creators, so this guard cannot silently stop checking", () => {
    expect(creators.map((c) => c.file).sort()).toEqual([
      "consolidation-runner.ts",
      "reflect-child.ts",
      "session-boot.ts",
      "wiki-synthesis.ts",
    ]);
  });

  it.each(creators.map((c) => c.file))(
    "%s either gates its tools or has none",
    (file) => {
      const source = creators.find((c) => c.file === file)!.source;
      const gated = GATE_MARKERS.some((marker) => source.includes(marker));
      const toolless = NO_TOOLS_MARKERS.some((marker) => source.includes(marker));
      expect(
        gated || toolless,
        `${file} creates a Pi session but neither installs the permission gate nor disables tools. ` +
          `An ungated session bypasses the zone model and the hardcoded denylist (NFR-SEC-02, NFR-SEC-04).`,
      ).toBe(true);
    },
  );

  it("createMaintenanceSession installs the gate on the session it opens", async () => {
    // The behavioural check the source scan cannot make: open a fake session and
    // observe that the hook was attached to *that object*. Removing the
    // installMaintenanceGate call fails this, which is the regression that
    // matters — the source scan alone still passed with the bug reintroduced.
    const fake = { agent: {}, subscribe: vi.fn(() => () => {}), prompt: vi.fn(), dispose: vi.fn() };
    await createMaintenanceSession({
      rootDir: "/home/buddy",
      modelRuntime: {} as never,
      depth: 1,
      openSession: async () => fake as unknown as MaintenanceAgentSession,
    });

    const hook = (fake.agent as { beforeToolCall?: unknown }).beforeToolCall;
    expect(typeof hook, "the maintenance session must have a permission hook").toBe("function");

    const blocked = await (
      hook as (ctx: unknown, signal: AbortSignal) => Promise<{ block?: boolean } | undefined>
    )({ toolCall: { name: "read" }, args: { path: "/etc/hosts" } }, new AbortController().signal);
    expect(blocked?.block, "the installed hook must actually deny outside paths").toBe(true);
  });

  it("blocks read and write to user/wiki/ paths", async () => {
    const fake = { agent: {}, subscribe: vi.fn(() => () => {}), prompt: vi.fn(), dispose: vi.fn() };
    await createMaintenanceSession({
      rootDir: "/home/buddy",
      modelRuntime: {} as never,
      depth: 1,
      openSession: async () => fake as unknown as MaintenanceAgentSession,
    });
    const hook = (fake.agent as { beforeToolCall?: unknown }).beforeToolCall as (
      ctx: unknown,
      signal: AbortSignal,
    ) => Promise<{ block?: boolean } | undefined>;

    const writeBlocked = await hook(
      { toolCall: { name: "write" }, args: { path: "user/wiki/concepts/foo.md" } },
      new AbortController().signal,
    );
    expect(writeBlocked?.block).toBe(true);

    const readBlocked = await hook(
      { toolCall: { name: "read" }, args: { path: "user/wiki/index.md" } },
      new AbortController().signal,
    );
    expect(readBlocked?.block).toBe(true);
  });

  it("every session creator supplies buddy's own ModelRuntime", () => {
    // The 231ac31 defect: reflect-child omitted modelRuntime in one mode, so the
    // SDK resolved credentials from the global ~/.pi/ config instead.
    for (const { file, source } of creators) {
      expect(source.includes("modelRuntime"), `${file} must pass modelRuntime`).toBe(true);
    }
  });
});
