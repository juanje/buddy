// shared/tool-paths.ts — Which arguments of which tool carry a filesystem path
// (NFR-SEC-13).
//
// The permission gate used to read exactly one argument: `args.path`. That is
// correct for the six built-in tools and wrong for every custom one Buddy adds.
// `copy_file`, `move_file` and `relocate_brain_file` take `source` and
// `destination`, so the denylist the gate applies before anything else — the
// one that blocks ~/.ssh, ~/.aws and .env with no prompt and no override
// (FR-PERM-04) — simply did not run for them.
//
// The failure mode is quiet by construction: a new tool with a path argument
// under a new name is not rejected, it is *ignored*, and nothing in the output
// says a check was skipped. So the declaration is mandatory rather than
// optional, and `tests/unit/tool-path-args.test.ts` fails the suite when a
// registered tool has a path-shaped parameter that is absent from this table.

/** Argument names that carry a filesystem path, per tool. */
export const TOOL_PATH_ARGS: Record<string, readonly string[]> = {
  // Built-in Pi tools (AGENT_TOOLS).
  read: ["path"],
  write: ["path"],
  edit: ["path"],
  grep: ["path"],
  find: ["path"],
  ls: ["path"],
  // Buddy's own file tools.
  delete_file: ["path"],
  copy_file: ["source", "destination"],
  move_file: ["source", "destination"],
  // Consolidation-only.
  relocate_brain_file: ["source", "destination"],
  // Takes a URL, not a path. Destination containment is fetch_url's own
  // business (it only ever writes under downloads/), and NFR-SEC-12 governs
  // where it may connect.
  fetch_url: [],
};

/**
 * Parameter names that must be declared in `TOOL_PATH_ARGS` when a tool has
 * them. Deliberately broad: a false positive costs one line in the table, a
 * false negative costs a permission check nobody notices is missing.
 */
export const PATH_SHAPED_ARG_NAMES = [
  "path",
  "paths",
  "file",
  "filepath",
  "file_path",
  "filename",
  "dir",
  "directory",
  "folder",
  "source",
  "src",
  "destination",
  "dest",
  "target",
  "location",
];

export function isPathShapedArgName(name: string): boolean {
  return PATH_SHAPED_ARG_NAMES.includes(name.toLowerCase());
}

/**
 * The path-valued arguments present in a tool call, in declaration order.
 *
 * An unknown tool yields nothing: tools with no filesystem reach (the skill
 * tools take no arguments at all) must not be forced through path validation.
 * The guard test is what keeps "unknown" from quietly meaning "unchecked".
 */
export function pathArgsOf(toolName: string, args: unknown): string[] {
  const declared = TOOL_PATH_ARGS[toolName];
  if (!declared || declared.length === 0) return [];

  const record = args as Record<string, unknown> | undefined;
  if (!record) return [];

  const found: string[] = [];
  for (const name of declared) {
    const value = record[name];
    if (typeof value === "string" && value.trim() !== "") found.push(value);
  }
  return found;
}
