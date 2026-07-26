// backends/file-tools.ts — FR-DELETE-01, FR-FILE-01, FR-FILE-02 file operation tools.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import {
  IDENTITY_ROOT_FILES,
  PROTECTED_DIRS,
  USER_MUTABLE_DIRS,
} from "../shared/defaults";
import { isWithin } from "../shared/path-utils";
import { gitClient } from "./git";
import { evaluateToolCall } from "./permissions";

export class FileToolError extends Error {}

export interface ResolvedWorkspacePath {
  absPath: string;
  relPath: string;
}

export interface FileToolOptions {
  home?: string;
  confirmDelete?: (absPath: string) => Promise<boolean>;
  askReadPermission?: (absPath: string) => Promise<boolean>;
}

function expandHome(path: string, home: string): string {
  return path === "~" ? home : path.startsWith("~/") ? join(home, path.slice(2)) : path;
}

function normalizeRelPath(rootDir: string, absPath: string): string {
  return relative(rootDir, absPath).split(sep).join("/");
}

function resolveInputPath(rootDir: string, rawPath: string, home: string): string {
  const expanded = expandHome(rawPath.trim(), home);
  return isAbsolutePath(expanded) ? resolve(expanded) : resolve(rootDir, expanded);
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function isIdentityPath(relPath: string): boolean {
  if (IDENTITY_ROOT_FILES.includes(relPath as (typeof IDENTITY_ROOT_FILES)[number])) {
    return true;
  }
  return relPath.startsWith("agent_brain/identity/");
}

function isProtectedPath(relPath: string): boolean {
  if (isIdentityPath(relPath)) return true;
  return PROTECTED_DIRS.some(
    (dir) => relPath === dir || relPath.startsWith(`${dir}/`),
  );
}

function isUserMutablePath(relPath: string): boolean {
  return USER_MUTABLE_DIRS.some(
    (dir) => relPath === dir || relPath.startsWith(`${dir}/`),
  );
}

function assertInsideRoot(rootDir: string, absPath: string): ResolvedWorkspacePath {
  if (!isWithin(absPath, rootDir)) {
    throw new FileToolError("Path is outside the buddy workspace and is not allowed.");
  }
  return { absPath, relPath: normalizeRelPath(rootDir, absPath) };
}

export function validateDeletablePath(
  rootDir: string,
  rawPath: string,
  home: string = homedir(),
): ResolvedWorkspacePath {
  const resolved = assertInsideRoot(rootDir, resolveInputPath(rootDir, rawPath, home));
  if (isProtectedPath(resolved.relPath) || !isUserMutablePath(resolved.relPath)) {
    throw new FileToolError(`Deletion is not allowed for path: ${resolved.relPath}`);
  }
  return resolved;
}

export function validateCopyDestination(
  rootDir: string,
  rawPath: string,
  home: string = homedir(),
): ResolvedWorkspacePath {
  const resolved = assertInsideRoot(rootDir, resolveInputPath(rootDir, rawPath, home));
  if (!isUserMutablePath(resolved.relPath)) {
    throw new FileToolError(`Copy destination is not allowed: ${resolved.relPath}`);
  }
  return resolved;
}

export function validateMoveSource(
  rootDir: string,
  rawPath: string,
  home: string = homedir(),
): ResolvedWorkspacePath {
  const resolved = assertInsideRoot(rootDir, resolveInputPath(rootDir, rawPath, home));
  if (isProtectedPath(resolved.relPath) || !isUserMutablePath(resolved.relPath)) {
    throw new FileToolError(`Move source is not allowed: ${resolved.relPath}`);
  }
  return resolved;
}

export function validateMoveDestination(
  rootDir: string,
  rawPath: string,
  home: string = homedir(),
): ResolvedWorkspacePath {
  const resolved = assertInsideRoot(rootDir, resolveInputPath(rootDir, rawPath, home));
  if (isProtectedPath(resolved.relPath)) {
    throw new FileToolError(`Move destination is not allowed: ${resolved.relPath}`);
  }
  return resolved;
}

async function isGitTracked(rootDir: string, relPath: string): Promise<boolean> {
  try {
    await gitClient(rootDir).raw(["ls-files", "--error-unmatch", "--", relPath]);
    return true;
  } catch {
    return false;
  }
}

async function ensureReadPermission(
  rootDir: string,
  sourcePath: string,
  home: string,
  askReadPermission: (absPath: string) => Promise<boolean>,
): Promise<void> {
  const absPath = resolveInputPath(rootDir, sourcePath, home);
  if (isWithin(absPath, rootDir)) return;

  const decision = evaluateToolCall("read", { path: sourcePath }, rootDir, home);
  if (decision.action === "allow") return;
  if (decision.action === "deny") {
    throw new FileToolError(decision.reason);
  }

  const allowed = await askReadPermission(decision.path);
  if (!allowed) {
    throw new FileToolError(`The user declined read access to ${decision.path}.`);
  }
}

export async function deleteWorkspaceFile(
  rootDir: string,
  rawPath: string,
  confirmDelete: (absPath: string) => Promise<boolean>,
  home: string = homedir(),
): Promise<string> {
  const { absPath, relPath } = validateDeletablePath(rootDir, rawPath, home);
  if (!existsSync(absPath)) {
    throw new FileToolError(`File does not exist: ${relPath}`);
  }
  if (statSync(absPath).isDirectory()) {
    throw new FileToolError(`Path is a directory, not a file: ${relPath}`);
  }

  const confirmed = await confirmDelete(absPath);
  if (!confirmed) {
    return `Deletion declined for ${relPath}.`;
  }

  if (await isGitTracked(rootDir, relPath)) {
    await gitClient(rootDir).rm(relPath);
  } else {
    unlinkSync(absPath);
  }

  return `Deleted ${relPath}.`;
}

export async function copyWorkspaceFile(
  rootDir: string,
  sourcePath: string,
  destinationPath: string,
  askReadPermission: (absPath: string) => Promise<boolean>,
  home: string = homedir(),
): Promise<string> {
  await ensureReadPermission(rootDir, sourcePath, home, askReadPermission);

  const sourceAbs = resolveInputPath(rootDir, sourcePath, home);
  if (!existsSync(sourceAbs)) {
    throw new FileToolError(`Source file does not exist: ${sourcePath}`);
  }
  if (statSync(sourceAbs).isDirectory()) {
    throw new FileToolError(`Source path is a directory, not a file: ${sourcePath}`);
  }

  const { absPath: destAbs, relPath: destRel } = validateCopyDestination(
    rootDir,
    destinationPath,
    home,
  );
  mkdirSync(dirname(destAbs), { recursive: true });
  copyFileSync(sourceAbs, destAbs);

  return `Copied ${sourcePath} → ${destRel}.`;
}

export async function moveWorkspaceFile(
  rootDir: string,
  sourcePath: string,
  destinationPath: string,
  home: string = homedir(),
): Promise<string> {
  const { absPath: srcAbs, relPath: srcRel } = validateMoveSource(rootDir, sourcePath, home);
  if (!existsSync(srcAbs)) {
    throw new FileToolError(`Source file does not exist: ${srcRel}`);
  }
  if (statSync(srcAbs).isDirectory()) {
    throw new FileToolError(`Source path is a directory, not a file: ${srcRel}`);
  }

  const { absPath: destAbs, relPath: destRel } = validateMoveDestination(
    rootDir,
    destinationPath,
    home,
  );
  mkdirSync(dirname(destAbs), { recursive: true });

  if (await isGitTracked(rootDir, srcRel)) {
    await gitClient(rootDir).mv(srcRel, destRel);
  } else {
    renameSync(srcAbs, destAbs);
  }

  return `Moved ${srcRel} → ${destRel}.`;
}

export function buildFileTools(rootDir: string, options?: FileToolOptions): ToolDefinition[] {
  const home = options?.home ?? homedir();
  const confirmDelete =
    options?.confirmDelete ??
    (async () => {
      throw new FileToolError("Delete confirmation is not configured.");
    });
  const askReadPermission =
    options?.askReadPermission ??
    (async () => {
      throw new FileToolError("Read permission handler is not configured.");
    });

  return [
    defineTool({
      name: "delete_file",
      label: "Delete file",
      description:
        "Delete a file from user/ or downloads/. Requires user confirmation. Cannot delete brain memory, logs, or identity files.",
      parameters: Type.Object({
        path: Type.String({
          description: "Path to the file to delete (relative to workspace, in user/ or downloads/)",
        }),
      }),
      async execute(_callId, args) {
        try {
          const text = await deleteWorkspaceFile(rootDir, args.path, confirmDelete, home);
          return { content: [{ type: "text", text }], details: { path: args.path } };
        } catch (error) {
          throw toToolError(error);
        }
      },
    }),
    defineTool({
      name: "copy_file",
      label: "Copy file",
      description:
        "Copy a file byte-for-byte into user/ or downloads/. Use for external files instead of read+write. Source may be outside the workspace (permission required).",
      parameters: Type.Object({
        source: Type.String({ description: "Source file path (absolute or relative)" }),
        destination: Type.String({
          description: "Destination path inside user/ or downloads/",
        }),
      }),
      async execute(_callId, args) {
        try {
          const text = await copyWorkspaceFile(
            rootDir,
            args.source,
            args.destination,
            askReadPermission,
            home,
          );
          return {
            content: [{ type: "text", text }],
            details: { source: args.source, destination: args.destination },
          };
        } catch (error) {
          throw toToolError(error);
        }
      },
    }),
    defineTool({
      name: "move_file",
      label: "Move file",
      description:
        "Move or rename a file within the workspace (user/ or downloads/). Does not rewrite markdown links.",
      parameters: Type.Object({
        source: Type.String({ description: "Current file path inside the workspace" }),
        destination: Type.String({ description: "New file path inside the workspace" }),
      }),
      async execute(_callId, args) {
        try {
          const text = await moveWorkspaceFile(rootDir, args.source, args.destination, home);
          return {
            content: [{ type: "text", text }],
            details: { source: args.source, destination: args.destination },
          };
        } catch (error) {
          throw toToolError(error);
        }
      },
    }),
  ];
}

function toToolError(error: unknown): Error {
  if (error instanceof FileToolError) return error;
  if (error instanceof Error) return error;
  return new Error(String(error));
}

export function fileToolNames(tools: ToolDefinition[]): string[] {
  return tools.map((tool) => tool.name);
}

/** Invoke a file tool and return its text payload (tests + BDD). */
export async function executeFileTool(
  tools: ToolDefinition[],
  name: string,
  args: Record<string, string>,
): Promise<string> {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`File tool not found: ${name}`);

  try {
    const result = await tool.execute(
      "test-call",
      args,
      new AbortController().signal,
      () => {},
      {} as never,
    );
    const textBlock = result.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
