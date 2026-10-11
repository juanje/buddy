// shared/data/registry-lookup.ts — Resolve registry entries at runtime (FR-DATA-03).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_REGISTRY_RELPATH } from "./registry-path";
import {
  parseDataRegistryDocument,
  type DataRegistryEntry,
} from "./registry";

export function normalizeRegistryRelPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function loadRegistryFromRoot(rootDir: string): DataRegistryEntry[] {
  const abs = join(rootDir, DATA_REGISTRY_RELPATH);
  if (!existsSync(abs)) return [];
  return parseDataRegistryDocument(readFileSync(abs, "utf8")).entries;
}

export function findRegistryEntry(
  rootDir: string,
  name: string,
): DataRegistryEntry | undefined {
  return loadRegistryFromRoot(rootDir).find((e) => e.name === name);
}

export function registeredDataRelPaths(rootDir: string): string[] {
  return loadRegistryFromRoot(rootDir).map((e) => normalizeRegistryRelPath(e.path));
}

export function isRegisteredDataRelPath(rootDir: string, relPath: string): boolean {
  const norm = normalizeRegistryRelPath(relPath);
  return registeredDataRelPaths(rootDir).includes(norm);
}
