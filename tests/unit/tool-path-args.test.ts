// tests/unit/tool-path-args.test.ts — NFR-SEC-13.
//
// Three things are checked here, and the third is the reason the file exists.
//
//   1. The gate inspects every declared path argument, not just `args.path`.
//   2. The denylist therefore covers copy_file/move_file, which it did not.
//   3. Every registered tool with a path-shaped parameter appears in
//      TOOL_PATH_ARGS — so adding a tool whose path argument has a new name
//      breaks the build instead of silently opting out of the permission layer.
//
// (3) is the guard. Without it the table is documentation, and documentation
// does not stop the next tool from being written with a `target` argument.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { TOOL_PATH_ARGS, isPathShapedArgName, pathArgsOf } from "../../shared/tool-paths";
import { AGENT_TOOLS } from "../../shared/defaults";
import { createPermissionGate } from "../../backends/permissions";
import { buildConsolidationTools } from "../../backends/consolidation-tools";
import { buildAgentToolset } from "../../backends/session-boot";

let home: string;
let root: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "tool-path-args-"));
  root = join(home, "buddy");
  mkdirSync(join(root, "user"), { recursive: true });
  mkdirSync(join(home, ".ssh"), { recursive: true });
  writeFileSync(join(home, ".ssh", "id_rsa"), "PRIVATE KEY");
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function gate() {
  return createPermissionGate(root, async () => true, home);
}

describe("pathArgsOf", () => {
  it("returns every declared path argument", () => {
    expect(pathArgsOf("copy_file", { source: "a", destination: "b" })).toEqual(["a", "b"]);
  });

  it("skips absent, blank and non-string values", () => {
    expect(pathArgsOf("copy_file", { source: "a", destination: "  " })).toEqual(["a"]);
    expect(pathArgsOf("copy_file", { source: 42, destination: "b" })).toEqual(["b"]);
  });

  it("returns nothing for a tool with no path arguments", () => {
    expect(pathArgsOf("fetch_url", { url: "https://example.com" })).toEqual([]);
  });
});

describe("the gate reads every declared path argument", () => {
  it("blocks a denylisted copy_file source", async () => {
    // Before NFR-SEC-13 the gate looked only at `args.path`, so this call
    // passed straight through the layer that exists to make ~/.ssh
    // unreachable without a prompt.
    const result = await gate().check("copy_file", {
      source: join(home, ".ssh", "id_rsa"),
      destination: "user/key.txt",
    });
    expect(result?.block).toBe(true);
  });

  it("blocks a denylisted move_file destination", async () => {
    const result = await gate().check("move_file", {
      source: "user/notes.md",
      destination: join(home, ".ssh", "authorized_keys"),
    });
    expect(result?.block).toBe(true);
  });

  it("blocks a denylisted basename anywhere, under any argument name", async () => {
    const result = await gate().check("copy_file", {
      source: join(root, "user", ".env"),
      destination: "user/copy.txt",
    });
    expect(result?.block).toBe(true);
  });

  it("leaves an ordinary in-workspace call alone", async () => {
    const result = await gate().check("move_file", {
      source: "user/a.md",
      destination: "user/b.md",
    });
    expect(result).toBeUndefined();
  });

  it("still blocks the single-argument case it always did", async () => {
    const result = await gate().check("read", { path: join(home, ".ssh", "id_rsa") });
    expect(result?.block).toBe(true);
  });
});

describe("every registered tool declares its path arguments", () => {
  function registeredTools(): ToolDefinition[] {
    // The live set comes from the function a session actually calls, so a tool
    // added there is covered here without anyone updating a list. Consolidation
    // assembles its own, and is added explicitly.
    return [
      ...buildAgentToolset(root, { requestPermission: async () => true, showFile: () => {} })
        .customTools,
      ...buildConsolidationTools(root),
    ];
  }

  function parameterNames(tool: ToolDefinition): string[] {
    const schema = tool.parameters as { properties?: Record<string, unknown> } | undefined;
    return Object.keys(schema?.properties ?? {});
  }

  it("covers the built-in Pi tools", () => {
    for (const name of AGENT_TOOLS) {
      expect(TOOL_PATH_ARGS[name], `${name} is not declared`).toBeDefined();
    }
  });

  it("declares a table entry for every custom tool", () => {
    for (const tool of registeredTools()) {
      expect(TOOL_PATH_ARGS[tool.name], `${tool.name} is not declared`).toBeDefined();
    }
  });

  it("leaves no path-shaped parameter undeclared", () => {
    const undeclared: string[] = [];
    for (const tool of registeredTools()) {
      const declared = TOOL_PATH_ARGS[tool.name] ?? [];
      for (const param of parameterNames(tool)) {
        if (isPathShapedArgName(param) && !declared.includes(param)) {
          undeclared.push(`${tool.name}.${param}`);
        }
      }
    }
    expect(undeclared).toEqual([]);
  });
});
