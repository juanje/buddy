// tests/unit/state-file-concurrency.test.ts — NFR-REL-06.
//
// The lost-update bug is between *processes*: the reflect child writes the same
// usage.json as the worker. In-process tests cannot reproduce it, because the
// sync fs calls never interleave. So this spawns real processes.
//
// Verified against the pre-H5 implementation (plain read-modify-write): it lost
// updates on every run. If this test ever passes trivially, check that the
// children are really running concurrently.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getMonthlySummaryFromFile } from "../../backends/usage-tracker";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");

const WRITERS = 4;
const WRITES_PER_WRITER = 8;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "usage-concurrency-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Child script: append N usage records of 1 token / $0.01 each. */
function writeChildScript(): string {
  const scriptPath = join(dir, "writer.ts");
  writeFileSync(
    scriptPath,
    `
import { recordUsageToFile } from ${JSON.stringify(join(REPO_ROOT, "backends", "usage-tracker.ts"))};
const [configDir, count] = process.argv.slice(2);
for (let i = 0; i < Number(count); i++) {
  recordUsageToFile(configDir, { cost: 0.01, tokens: 1 }, new Date("2026-07-27T12:00:00Z"));
}
`,
    "utf8",
  );
  return scriptPath;
}

function runWriter(scriptPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", scriptPath, dir, String(WRITES_PER_WRITER)],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`writer exited ${code}: ${stderr}`));
    });
  });
}

describe("usage.json under concurrent writers", () => {
  it(
    "loses no update when separate processes write at once",
    async () => {
      const scriptPath = writeChildScript();
      await Promise.all(Array.from({ length: WRITERS }, () => runWriter(scriptPath)));

      const total = getMonthlySummaryFromFile(dir, new Date("2026-07-27T12:00:00Z"));
      const expected = WRITERS * WRITES_PER_WRITER;

      expect(total.messageCount).toBe(expected);
      expect(total.totalTokens).toBe(expected);
      expect(total.totalCost).toBeCloseTo(expected * 0.01, 6);
    },
    30_000,
  );
});
