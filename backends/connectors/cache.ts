// backends/connectors/cache.ts — Connector cache engine (FR-CONN-02/03).

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type { CacheEntry, CacheEntryMeta, ConnectorResult } from "../../shared/connector-types";
import { CONNECTIONS_DIR } from "../../shared/defaults";
import { MS_PER_DAY, MS_PER_HOUR } from "../../shared/dates";
import { isContained } from "../containment";
import { writeStateFile } from "../state-file";

export class ConnectorCacheError extends Error {}

export type EntityStore = Record<string, CacheEntry>;

export interface QueryStore {
  keys: string[];
  synced_at: string;
  stale_after: string;
  source?: string;
}

const STALE_AFTER_PATTERN = /^(\d+)(m|h|d)$/;

export function connectionsDir(rootDir: string, domain?: string): string {
  const base = join(rootDir, CONNECTIONS_DIR);
  return domain ? join(base, domain) : base;
}

/** Parse freshness budget strings like 15m, 1h, 24h, 7d. */
export function parseStaleAfterMs(staleAfter: string): number {
  const match = STALE_AFTER_PATTERN.exec(staleAfter.trim());
  if (!match) {
    throw new ConnectorCacheError(`Invalid stale_after value: ${staleAfter}`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "m") return amount * 60_000;
  if (unit === "h") return amount * MS_PER_HOUR;
  return amount * MS_PER_DAY;
}

export function isCacheStale(meta: CacheEntryMeta, force = false, nowMs = Date.now()): boolean {
  if (force) return true;
  const syncedAt = Date.parse(meta.synced_at);
  if (Number.isNaN(syncedAt)) return true;
  const budgetMs = parseStaleAfterMs(meta.stale_after);
  return nowMs - syncedAt >= budgetMs;
}

export function assertCacheContainment(absPath: string, rootDir: string): void {
  const cacheRoot = connectionsDir(rootDir);
  if (!isContained(absPath, cacheRoot)) {
    throw new ConnectorCacheError(
      `Connector cache writes are confined to ${CONNECTIONS_DIR}/; refused: ${absPath}`,
    );
  }
}

function entityStorePath(rootDir: string, domain: string): string {
  return join(connectionsDir(rootDir, domain), "entities.json");
}

function queryStorePath(rootDir: string, domain: string, queryId: string): string {
  return join(connectionsDir(rootDir, domain), "queries", `${queryId}.json`);
}

function threadFilePath(rootDir: string, domain: string, threadId: string): string {
  return join(connectionsDir(rootDir, domain), "threads", `${threadId}.md`);
}

function userDirectoryPath(rootDir: string, domain: string): string {
  return join(connectionsDir(rootDir, domain), "users.json");
}

export interface UserDirectoryEntry {
  accountId: string;
  displayName: string;
  synced_at: string;
}

export type UserDirectory = Record<string, UserDirectoryEntry>;

export function readUserDirectory(rootDir: string, domain: string): UserDirectory {
  return readJsonFile<UserDirectory>(userDirectoryPath(rootDir, domain)) ?? {};
}

export function writeUserDirectory(rootDir: string, domain: string, dir: UserDirectory): void {
  const path = userDirectoryPath(rootDir, domain);
  assertCacheContainment(path, rootDir);
  writeStateFile(path, dir);
}

/** Add or update a user entry. Key is lowercase displayName for case-insensitive lookup. */
export function upsertUser(
  dir: UserDirectory,
  accountId: string,
  displayName: string,
): UserDirectory {
  const key = displayName.toLowerCase();
  dir[key] = { accountId, displayName, synced_at: new Date().toISOString() };
  return dir;
}

/** Look up a user by display name (exact, case-insensitive). */
export function lookupUser(
  dir: UserDirectory,
  query: string,
): UserDirectoryEntry | undefined {
  return dir[query.toLowerCase()];
}

/** Find all entries whose display name contains the query (case-insensitive). */
export function searchUserDirectory(
  dir: UserDirectory,
  query: string,
): UserDirectoryEntry[] {
  const q = query.toLowerCase();
  return Object.values(dir).filter((e) => e.displayName.toLowerCase().includes(q));
}

function readJsonFile<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function readEntityStore(rootDir: string, domain: string): EntityStore {
  const path = entityStorePath(rootDir, domain);
  return readJsonFile<EntityStore>(path) ?? {};
}

export function writeEntityStore(rootDir: string, domain: string, store: EntityStore): void {
  const path = entityStorePath(rootDir, domain);
  assertCacheContainment(path, rootDir);
  writeStateFile(path, store);
}

export function readQueryStore(
  rootDir: string,
  domain: string,
  queryId: string,
): QueryStore | undefined {
  return readJsonFile<QueryStore>(queryStorePath(rootDir, domain, queryId));
}

export function writeQueryStore(
  rootDir: string,
  domain: string,
  queryId: string,
  store: QueryStore,
): void {
  const path = queryStorePath(rootDir, domain, queryId);
  assertCacheContainment(path, rootDir);
  writeStateFile(path, store);
}

export function readThreadFile(
  rootDir: string,
  domain: string,
  threadId: string,
): { meta: CacheEntryMeta; body: string } | undefined {
  const path = threadFilePath(rootDir, domain, threadId);
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) return undefined;
  const frontmatter = Object.fromEntries(
    match[1].split("\n").flatMap((line) => {
      const idx = line.indexOf(":");
      if (idx < 0) return [];
      return [[line.slice(0, idx).trim(), line.slice(idx + 1).trim()]];
    }),
  ) as unknown as CacheEntryMeta;
  return { meta: frontmatter, body: match[2] };
}

export function writeThreadFile(
  rootDir: string,
  domain: string,
  threadId: string,
  meta: CacheEntryMeta,
  body: string,
): void {
  const path = threadFilePath(rootDir, domain, threadId);
  assertCacheContainment(path, rootDir);
  mkdirSync(join(path, ".."), { recursive: true });
  const frontmatter = [
    "---",
    `synced_at: ${meta.synced_at}`,
    `stale_after: ${meta.stale_after}`,
    meta.source ? `source: ${meta.source}` : undefined,
    "---",
    "",
    body,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
  writeTextFileAtomic(path, frontmatter);
}

/** Build a ConnectorResult from cached data with structured staleness (§17.6). */
export function connectorResultFromCache(
  data: string,
  meta: CacheEntryMeta,
  options?: { force?: boolean; nowMs?: number },
): ConnectorResult {
  const stale = isCacheStale(meta, options?.force, options?.nowMs);
  return {
    data,
    stale,
    synced_at: meta.synced_at,
  };
}

function writeTextFileAtomic(path: string, contents: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, contents, "utf8");
    renameSync(tmp, path);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // Target untouched on failure.
    }
    throw error;
  }
}

/** Remove entity entries and cache files older than retention budgets. */
export function pruneConnectorCache(
  rootDir: string,
  entityRetentionDays: number,
  threadRetentionDays: number,
  nowMs = Date.now(),
): number {
  const base = connectionsDir(rootDir);
  if (!existsSync(base)) return 0;

  let removed = 0;
  for (const domain of readdirSync(base)) {
    const domainDir = join(base, domain);
    if (!statSync(domainDir).isDirectory()) continue;

    const entityPath = join(domainDir, "entities.json");
    if (existsSync(entityPath)) {
      const store = readJsonFile<EntityStore>(entityPath) ?? {};
      let changed = false;
      for (const [key, entry] of Object.entries(store)) {
        const syncedAt = Date.parse(entry.synced_at);
        if (Number.isNaN(syncedAt)) continue;
        if (nowMs - syncedAt >= entityRetentionDays * MS_PER_DAY) {
          delete store[key];
          changed = true;
          removed++;
        }
      }
      if (changed) {
        writeEntityStore(rootDir, domain, store);
      }
    }

    for (const sub of ["queries", "threads"] as const) {
      const subDir = join(domainDir, sub);
      if (!existsSync(subDir)) continue;
      for (const name of readdirSync(subDir)) {
        const filePath = join(subDir, name);
        try {
          if (statSync(filePath).mtimeMs < nowMs - threadRetentionDays * MS_PER_DAY) {
            unlinkSync(filePath);
            removed++;
          }
        } catch {
          // Best effort — same as session-log-prune.
        }
      }
    }
  }
  return removed;
}

/** Test hook: attempt a cache write outside the connections directory. */
export function writeCacheFileForTest(rootDir: string, relPath: string, data: unknown): void {
  const absPath = join(rootDir, relPath);
  assertCacheContainment(absPath, rootDir);
  writeStateFile(absPath, data);
}

/** Remove the entire connector cache tree (tests). */
export function removeConnectorCache(rootDir: string): void {
  const base = connectionsDir(rootDir);
  if (existsSync(base)) rmSync(base, { recursive: true, force: true });
}
