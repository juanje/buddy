// backends/allowed-paths.ts — persistent outside-path allowlist (FR-PERM-06).
// Stored in ~/.buddy/allowed-paths.json; read access only (writes still prompt).

import { join, resolve } from "node:path";

import { readStateFile, updateStateFile } from "./state-file";

import { ALLOWED_PATHS_FILE_NAME } from "../shared/defaults";
import { globalConfigDir } from "./global-config";
import { isContained } from "./containment";

export interface AllowedEntry {
  path: string;
  type: "file" | "directory";
}

interface AllowedPathsFile {
  allowedPaths: AllowedEntry[];
}

/**
 * Directory holding ~/.buddy/config.json.
 *
 * NFR-CONFIG-05: kept as a name because the reflect child and the consolidation
 * runner import it, but it is no longer a second resolver — it is
 * `globalConfigDir()`. The two used to read different environment variables and
 * could name different directories in the same run.
 */
export function defaultConfigDir(): string {
  return globalConfigDir();
}

export function allowedPathsFile(configDir: string = defaultConfigDir()): string {
  return join(configDir, ALLOWED_PATHS_FILE_NAME);
}

function validEntries(parsed: Partial<AllowedPathsFile> | undefined): AllowedEntry[] {
  if (!Array.isArray(parsed?.allowedPaths)) return [];
  return parsed.allowedPaths.filter(
    (entry): entry is AllowedEntry =>
      typeof entry?.path === "string" &&
      entry.path.trim() !== "" &&
      (entry.type === "file" || entry.type === "directory"),
  );
}

/**
 * Read the persisted allowlist. An unreadable file throws (NFR-REL-08) instead
 * of reporting "no approvals": the previous behaviour let `addAllowedPath` then
 * write only the new entry, discarding every path the user had approved.
 */
export function loadAllowedPaths(configDir: string = defaultConfigDir()): AllowedEntry[] {
  return validEntries(readStateFile<Partial<AllowedPathsFile>>(allowedPathsFile(configDir)));
}

function normalizeEntry(entry: AllowedEntry): AllowedEntry {
  return { path: resolve(entry.path), type: entry.type };
}

function entryKey(entry: AllowedEntry): string {
  return `${entry.type}:${resolve(entry.path)}`;
}

export function addAllowedPath(
  configDir: string,
  entry: AllowedEntry,
): AllowedEntry[] {
  const normalized = normalizeEntry(entry);
  const updated = updateStateFile<AllowedPathsFile>(allowedPathsFile(configDir), (current) => {
    const existing = validEntries(current);
    const keys = new Set(existing.map(entryKey));
    return {
      allowedPaths: keys.has(entryKey(normalized)) ? existing : [...existing, normalized],
    };
  });
  return validEntries(updated);
}

/** True when read access to absPath was previously approved via "Allow always". */
export function isPathPersistentlyAllowed(absPath: string, entries: AllowedEntry[]): boolean {
  const resolved = resolve(absPath);
  for (const entry of entries) {
    const allowedPath = resolve(entry.path);
    if (entry.type === "file") {
      if (allowedPath === resolved) return true;
      // NFR-SEC-15: the approval covers a directory, not everything a symlink
      // inside it happens to point at.
    } else if (isContained(resolved, allowedPath)) {
      return true;
    }
  }
  return false;
}
