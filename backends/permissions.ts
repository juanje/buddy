// backends/permissions.ts — permission zones for file tools (FR-PERM-01..04).
//
// Zones:
//   denylist — ~/.ssh/*, ~/.gnupg/*, ~/.aws/*, **/.env, **/auth.json:
//              blocked silently, no prompt, no override (FR-PERM-04).
//   identity — writes to SOUL.md ask for confirmation (FR-PERM-02).
//              USER.md writes are Zone 1 (silent allow).
//   ab-home  — anything else inside the buddy directory: silent allow (FR-PERM-01).
//   outside  — anything else: ask the user, allow-once or deny (FR-PERM-03).
//
// The layer installs as a chained `beforeToolCall` hook: an earlier hook's
// block wins; otherwise our decision applies.

import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { AllowedEntry } from "./allowed-paths";
import { isPathPersistentlyAllowed } from "./allowed-paths";
import { DENYLIST_BASENAMES, DENYLIST_HOME_DIRS, READ_TOOLS, WRITE_TOOLS } from "../shared/defaults";
import { windowsFilenameIssue } from "../shared/filename-safety";
import { pathArgsOf } from "../shared/tool-paths";
import { expandHome } from "../shared/path-utils";
import { isContained } from "./containment";
import { globalConfigDir } from "./global-config";
import { identityDirPath } from "./brain-paths";

/** Path arguments that are write destinations (NFR-SEC-22). */
function writeDestinationPaths(toolName: string, args: unknown): string[] {
  if (WRITE_TOOLS.has(toolName)) return pathArgsOf(toolName, args);
  if (
    toolName === "copy_file" ||
    toolName === "move_file" ||
    toolName === "relocate_brain_file"
  ) {
    const destination = (args as { destination?: unknown } | null)?.destination;
    return typeof destination === "string" ? [destination] : [];
  }
  return [];
}

export type PermissionOp = "read" | "write";

export interface PermissionRequest {
  id: number;
  kind: "identity-write" | "outside" | "delete-file";
  op: PermissionOp;
  path: string;
}

export type PermissionDecision =
  | { action: "allow" }
  | { action: "deny"; reason: string }
  | { action: "ask"; kind: PermissionRequest["kind"]; op: PermissionOp; path: string };

const IDENTITY_FILES = ["SOUL.md"];
/** Agent-managed config paths that must never be modified by the agent (NFR-SEC-06). */
const PROTECTED_CONFIG_RELPATHS = [join(".pi", "settings.json")];

export function isDenylistedPath(absPath: string, home: string = homedir()): boolean {
  // NFR-SEC-04 / FR-PERM-04: basename match is case-insensitive. On NTFS an
  // exact `includes` check fails open — `.ENV` opens the same file as `.env`
  // and never hit the denylist (Windows spike A2).
  const base = basename(absPath).toLowerCase();
  if (DENYLIST_BASENAMES.some((name) => name.toLowerCase() === base)) return true;
  return DENYLIST_HOME_DIRS.some((dir) => isContained(absPath, join(home, dir)));
}

function isProtectedConfig(absPath: string, rootDir: string): boolean {
  return PROTECTED_CONFIG_RELPATHS.some(
    (rel) => resolve(rootDir, rel) === absPath,
  );
}

function isIdentityFile(absPath: string, rootDir: string): boolean {
  const identityDir = identityDirPath(rootDir);
  return IDENTITY_FILES.some((file) => resolve(identityDir, file) === absPath);
}

/**
 * Decide what to do with a tool call. Non-file tools and pathless calls
 * (ls/grep default to the session cwd, which IS the buddy directory) are allowed.
 */
export function evaluateToolCall(
  toolName: string,
  args: unknown,
  rootDir: string,
  home: string = homedir(),
  configDir: string = globalConfigDir(),
): PermissionDecision {
  const op: PermissionOp | undefined = WRITE_TOOLS.has(toolName)
    ? "write"
    : READ_TOOLS.has(toolName)
      ? "read"
      : undefined;
  if (!op) return { action: "allow" }; // not a file tool

  // NFR-SEC-13: judge every declared path argument and return the most
  // restrictive verdict. A tool is only as contained as its least contained
  // argument.
  const rawPaths = pathArgsOf(toolName, args);
  if (rawPaths.length === 0) {
    return { action: "allow" }; // pathless: operates on the session cwd (buddy directory)
  }

  let pendingAsk: PermissionDecision | undefined;
  for (const rawPath of rawPaths) {
    const decision = evaluateOnePath(rawPath, op, rootDir, home, configDir);
    if (decision.action === "deny") return decision;
    if (decision.action === "ask" && !pendingAsk) pendingAsk = decision;
  }
  return pendingAsk ?? { action: "allow" };
}

function evaluateOnePath(
  rawPath: string,
  op: PermissionOp,
  rootDir: string,
  home: string,
  configDir: string,
): PermissionDecision {
  // Relative paths resolve against the session cwd, which is the buddy home.
  const absPath = resolve(rootDir, expandHome(rawPath, home));

  if (isDenylistedPath(absPath, home)) {
    return { action: "deny", reason: `Access to ${absPath} is not allowed.` };
  }
  // NFR-SEC-22: refuse illegal Windows names before any write tool runs.
  if (op === "write") {
    const filenameIssue = windowsFilenameIssue(absPath);
    if (filenameIssue) return { action: "deny", reason: filenameIssue };
  }
  if (op === "write" && isIdentityFile(absPath, rootDir)) {
    return { action: "ask", kind: "identity-write", op, path: absPath };
  }
  if (op === "write" && isProtectedConfig(absPath, rootDir)) {
    return { action: "deny", reason: "Modifying model configuration is not allowed." };
  }
  // NFR-SEC-15: Zone 1 is decided on the resolved location. A symlink under the
  // buddy directory pointing at ~/Documents would otherwise make every file it
  // reaches a silent allow.
  if (isContained(absPath, rootDir)) {
    return { action: "allow" };
  }
  if (op === "read" && isContained(absPath, join(configDir, "docs"))) {
    return { action: "allow" };
  }
  return { action: "ask", kind: "outside", op, path: absPath };
}

// ---------------------------------------------------------------------------
// Hook gate: turns decisions into beforeToolCall results, delegating "ask"
// to the frontend (FR-PERM-07 renders the prompt; the tool call waits here).
// ---------------------------------------------------------------------------

export interface PermissionGate {
  /** beforeToolCall-compatible check. */
  check(toolName: string, args: unknown): Promise<{ block: true; reason: string } | undefined>;
}

export function createPermissionGate(
  rootDir: string,
  askUser: (request: Omit<PermissionRequest, "id">) => Promise<boolean>,
  home: string = homedir(),
  options?: {
    skipIdentityPrompt?: boolean;
    sessionAllowedPaths?: Set<string>;
    getPersistentAllowedPaths?: () => AllowedEntry[];
  },
): PermissionGate {
  const sessionAllowedPaths = options?.sessionAllowedPaths;
  const getPersistentAllowedPaths = options?.getPersistentAllowedPaths ?? (() => []);

  return {
    async check(toolName, args) {
      // NFR-SEC-13: every argument the tool declares as a path, not just
      // `args.path`. copy_file and move_file name theirs `source` and
      // `destination`, and the denylist below never ran for them.
      const rawPaths = pathArgsOf(toolName, args);
      for (const rawPath of rawPaths) {
        const absPath = resolve(rootDir, expandHome(rawPath, home));
        if (isDenylistedPath(absPath, home)) {
          return { block: true, reason: `Access to ${absPath} is not allowed.` };
        }
      }
      // NFR-SEC-22: write destinations (including copy/move/relocate).
      for (const rawPath of writeDestinationPaths(toolName, args)) {
        const absPath = resolve(rootDir, expandHome(rawPath, home));
        const filenameIssue = windowsFilenameIssue(absPath);
        if (filenameIssue) return { block: true, reason: filenameIssue };
      }
      if (sessionAllowedPaths && READ_TOOLS.has(toolName) && rawPaths.length > 0) {
        const absPaths = rawPaths.map((raw) => resolve(rootDir, expandHome(raw, home)));
        const approved = [...sessionAllowedPaths].map((allowed) => resolve(allowed));
        if (absPaths.every((absPath) => approved.includes(absPath))) return undefined;
      }

      const decision = evaluateToolCall(toolName, args, rootDir, home);
      if (
        options?.skipIdentityPrompt &&
        decision.action === "ask" &&
        decision.kind === "identity-write"
      ) {
        return undefined;
      }
      switch (decision.action) {
        case "allow":
          return undefined;
        case "deny":
          return { block: true, reason: decision.reason };
        case "ask": {
          if (
            decision.op === "read" &&
            decision.kind === "outside" &&
            isPathPersistentlyAllowed(decision.path, getPersistentAllowedPaths())
          ) {
            return undefined;
          }
          const allowed = await askUser({
            kind: decision.kind,
            op: decision.op,
            path: decision.path,
          });
          return allowed
            ? undefined
            : { block: true, reason: `The user declined ${decision.op} access to ${decision.path}.` };
        }
      }
    },
  };
}
