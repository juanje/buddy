// backends/allowed-paths.ts — persistent outside-path allowlist (FR-PERM-06).
// Stored in ~/.buddy/allowed-paths.json; read access only (writes still prompt).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { defaultConfigPath } from "./setup";

export interface AllowedEntry {
  path: string;
  type: "file" | "directory";
}

interface AllowedPathsFile {
  allowedPaths: AllowedEntry[];
}

function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/** Directory holding ~/.buddy/config.json (overridable via AB_CONFIG_PATH in tests). */
export function defaultConfigDir(): string {
  return dirname(defaultConfigPath());
}

export function allowedPathsFile(configDir: string = defaultConfigDir()): string {
  return join(configDir, "allowed-paths.json");
}

export function loadAllowedPaths(configDir: string = defaultConfigDir()): AllowedEntry[] {
  const filePath = allowedPathsFile(configDir);
  if (!existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<AllowedPathsFile>;
    if (!Array.isArray(parsed.allowedPaths)) return [];
    return parsed.allowedPaths.filter(
      (entry): entry is AllowedEntry =>
        typeof entry?.path === "string" &&
        entry.path.trim() !== "" &&
        (entry.type === "file" || entry.type === "directory"),
    );
  } catch {
    return [];
  }
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
  const existing = loadAllowedPaths(configDir);
  const keys = new Set(existing.map(entryKey));
  if (!keys.has(entryKey(normalized))) {
    existing.push(normalized);
  }
  writeAllowedPaths(configDir, existing);
  return existing;
}

function writeAllowedPaths(configDir: string, entries: AllowedEntry[]): void {
  const filePath = allowedPathsFile(configDir);
  mkdirSync(configDir, { recursive: true });
  const payload: AllowedPathsFile = { allowedPaths: entries };
  const tmp = join(configDir, `.allowed-paths.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
  renameSync(tmp, filePath);
}

/** True when read access to absPath was previously approved via "Allow always". */
export function isPathPersistentlyAllowed(absPath: string, entries: AllowedEntry[]): boolean {
  const resolved = resolve(absPath);
  for (const entry of entries) {
    const allowedPath = resolve(entry.path);
    if (entry.type === "file") {
      if (allowedPath === resolved) return true;
    } else if (isWithin(resolved, allowedPath)) {
      return true;
    }
  }
  return false;
}
