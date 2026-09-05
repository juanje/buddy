// tests/unit/connector-cache.test.ts — FR-CONN-02 cache engine.

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ConnectorCacheError,
  connectorResultFromCache,
  isCacheStale,
  parseStaleAfterMs,
  pruneConnectorCache,
  readEntityStore,
  writeEntityStore,
  writeCacheFileForTest,
} from "../../backends/connectors/cache";
import { MS_PER_DAY } from "../../shared/dates";

let rootDir: string;

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), "buddy-conn-cache-"));
});

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true });
});

describe("connector cache engine (FR-CONN-02)", () => {
  it("parses stale_after durations", () => {
    expect(parseStaleAfterMs("15m")).toBe(15 * 60_000);
    expect(parseStaleAfterMs("1h")).toBe(3_600_000);
    expect(parseStaleAfterMs("7d")).toBe(7 * MS_PER_DAY);
  });

  it("stores and reads entity entries", () => {
    writeEntityStore(rootDir, "jira", {
      "PROJ-1": {
        synced_at: new Date().toISOString(),
        stale_after: "15m",
        status: "Open",
      },
    });
    expect(readEntityStore(rootDir, "jira")["PROJ-1"]?.status).toBe("Open");
  });

  it("treats fresh entries as not stale", () => {
    const meta = { synced_at: new Date().toISOString(), stale_after: "15m" };
    expect(isCacheStale(meta)).toBe(false);
  });

  it("force bypasses a fresh cache entry", () => {
    const meta = { synced_at: new Date().toISOString(), stale_after: "15m" };
    expect(isCacheStale(meta, true)).toBe(true);
  });

  it("marks expired entries stale on ConnectorResult", () => {
    const syncedAt = new Date(Date.now() - 20 * 60_000).toISOString();
    const result = connectorResultFromCache("data", { synced_at: syncedAt, stale_after: "15m" });
    expect(result.stale).toBe(true);
    expect(result.synced_at).toBe(syncedAt);
  });

  it("refuses cache writes outside the connections directory", () => {
    expect(() => writeCacheFileForTest(rootDir, "user/board.md", {})).toThrow(ConnectorCacheError);
  });

  it("prunes old entity entries and thread files", () => {
    const old = new Date(Date.now() - 8 * MS_PER_DAY);
    writeEntityStore(rootDir, "jira", {
      OLD: { synced_at: old.toISOString(), stale_after: "15m" },
      NEW: { synced_at: new Date().toISOString(), stale_after: "15m" },
    });
    const threadPath = join(rootDir, ".buddy/connections/jira/threads/t1.md");
    writeCacheFileForTest(
      rootDir,
      ".buddy/connections/jira/threads/t1.md",
      "---\nsynced_at: x\nstale_after: 1h\n---\nbody",
    );
    utimesSync(threadPath, old, old);

    const removed = pruneConnectorCache(rootDir, 7, 1);
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(readEntityStore(rootDir, "jira").OLD).toBeUndefined();
    expect(readEntityStore(rootDir, "jira").NEW).toBeDefined();
    expect(existsSync(threadPath)).toBe(false);
  });

  it("uses atomic writes without leaving temp files behind", () => {
    writeEntityStore(rootDir, "jira", {
      A: { synced_at: new Date().toISOString(), stale_after: "15m" },
    });
    const entityPath = join(rootDir, ".buddy/connections/jira/entities.json");
    expect(existsSync(entityPath)).toBe(true);
    expect(readFileSync(entityPath, "utf8")).toContain("A");
    const dir = join(rootDir, ".buddy/connections/jira");
    const temps = existsSync(dir) ? readdirSync(dir).filter((name) => name.includes(".tmp")) : [];
    expect(temps).toHaveLength(0);
  });
});
