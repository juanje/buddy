// backends/permissions.ts — permission zones for file tools (FR-PERM-01..04).
//
// Zones:
//   denylist — ~/.ssh/*, ~/.gnupg/*, ~/.aws/*, **/.env, **/auth.json:
//              blocked silently, no prompt, no override (FR-PERM-04).
//   identity — writes to SOUL.md ask for confirmation (FR-PERM-02).
//              USER.md writes are Zone 1 (silent allow).
//   ab-home  — anything else inside the AB directory: silent allow (FR-PERM-01).
//   outside  — anything else: ask the user, allow-once or deny (FR-PERM-03).
//
// The layer installs as a chained `beforeToolCall` hook: an earlier hook's
// block wins; otherwise our decision applies.

import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import type { AllowedEntry } from "./allowed-paths";
import { isPathPersistentlyAllowed } from "./allowed-paths";
import { DENYLIST_BASENAMES, DENYLIST_HOME_DIRS, READ_TOOLS, WRITE_TOOLS } from "../shared/defaults";

export type PermissionOp = "read" | "write";

export interface PermissionRequest {
  id: number;
  kind: "identity-write" | "outside";
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

function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function isDenylistedPath(absPath: string, home: string = homedir()): boolean {
  if (DENYLIST_BASENAMES.includes(basename(absPath))) return true;
  return DENYLIST_HOME_DIRS.some((dir) => isWithin(absPath, join(home, dir)));
}

function isProtectedConfig(absPath: string, abDirectory: string): boolean {
  return PROTECTED_CONFIG_RELPATHS.some(
    (rel) => resolve(abDirectory, rel) === absPath,
  );
}

function isIdentityFile(absPath: string, abDirectory: string): boolean {
  const identityDir = join(abDirectory, "agent_brain", "identity");
  return IDENTITY_FILES.some((file) => resolve(identityDir, file) === absPath);
}

/**
 * Decide what to do with a tool call. Non-file tools and pathless calls
 * (ls/grep default to the session cwd, which IS the AB) are allowed.
 */
export function evaluateToolCall(
  toolName: string,
  args: unknown,
  abDirectory: string,
  home: string = homedir(),
): PermissionDecision {
  const op: PermissionOp | undefined = WRITE_TOOLS.has(toolName)
    ? "write"
    : READ_TOOLS.has(toolName)
      ? "read"
      : undefined;
  if (!op) return { action: "allow" }; // not a file tool

  const rawPath = (args as { path?: unknown } | undefined)?.path;
  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    return { action: "allow" }; // pathless: operates on the session cwd (AB)
  }

  // Relative paths resolve against the session cwd, which is the AB home.
  const absPath = resolve(abDirectory, expandHome(rawPath, home));

  if (isDenylistedPath(absPath, home)) {
    return { action: "deny", reason: `Access to ${absPath} is not allowed.` };
  }
  if (op === "write" && isIdentityFile(absPath, abDirectory)) {
    return { action: "ask", kind: "identity-write", op, path: absPath };
  }
  if (op === "write" && isProtectedConfig(absPath, abDirectory)) {
    return { action: "deny", reason: "Modifying model configuration is not allowed." };
  }
  if (isWithin(absPath, abDirectory)) {
    return { action: "allow" };
  }
  return { action: "ask", kind: "outside", op, path: absPath };
}

function expandHome(path: string, home: string): string {
  return path === "~" ? home : path.startsWith("~/") ? join(home, path.slice(2)) : path;
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
  abDirectory: string,
  askUser: (request: Omit<PermissionRequest, "id">) => Promise<boolean>,
  home: string = homedir(),
  options?: {
    skipIdentityPrompt?: boolean;
    sessionAllowedPaths?: Set<string>;
    persistentAllowedPaths?: AllowedEntry[];
  },
): PermissionGate {
  const sessionAllowedPaths = options?.sessionAllowedPaths;
  const persistentAllowedPaths = options?.persistentAllowedPaths ?? [];

  return {
    async check(toolName, args) {
      const rawPath = (args as { path?: unknown } | undefined)?.path;
      if (typeof rawPath === "string" && rawPath.trim() !== "") {
        const absPath = resolve(abDirectory, expandHome(rawPath, home));
        if (isDenylistedPath(absPath, home)) {
          return { block: true, reason: `Access to ${absPath} is not allowed.` };
        }
        if (
          sessionAllowedPaths &&
          READ_TOOLS.has(toolName)
        ) {
          for (const allowed of sessionAllowedPaths) {
            if (resolve(allowed) === absPath) return undefined;
          }
        }
      }

      const decision = evaluateToolCall(toolName, args, abDirectory, home);
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
            isPathPersistentlyAllowed(decision.path, persistentAllowedPaths)
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
