// backends/hebbian-guard.ts — Keep worker-owned counters out of the model's
// reach (FR-HEBB-06).
//
// `access_count` and `last_accessed` are written by the read hook and by
// nothing else (FR-HEBB-01/05). AGENTS.md says so to the agent — "never edit
// these fields on existing files" — and until now that was the whole of the
// enforcement.
//
// A rule cannot cover the case that actually broke it. On 2026-07-29 a local
// model failed eight consecutive `edit` calls, gave up, and rewrote
// `user/inbox.md` whole; the frontmatter came back reconstructed from memory
// with `access_count: 7` reduced to `1`. The model was not editing the fields.
// It was regenerating a file that happens to contain them, which no
// instruction about editing fields addresses.
//
// So the counters are captured before a write and put back after it. Everything
// else the write intended — body, summary, created, any key the agent
// legitimately owns — is kept exactly as written.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { toBuddyRelPath } from "../shared/path-utils";
import { parseFrontmatter } from "../shared/frontmatter";

/** Fields the worker owns; the model may read them, never write them. */
const GUARDED_FIELDS = ["access_count", "last_accessed"] as const;

export interface HebbianGuard {
  /** Remember the counters before a tool writes to this path. */
  capture(path: string): void;
  /** Put them back if the write changed them. Returns true if it repaired. */
  restore(path: string): boolean;
}

function readGuarded(absPath: string): Record<string, string> | null {
  if (!existsSync(absPath)) return null;
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
  if (!content.startsWith("---\n")) return null;

  const fields = parseFrontmatter(content);
  const present: Record<string, string> = {};
  for (const key of GUARDED_FIELDS) {
    if (key in fields) present[key] = fields[key];
  }
  return Object.keys(present).length > 0 ? present : null;
}

export function createHebbianGuard(rootDir: string): HebbianGuard {
  const captured = new Map<string, Record<string, string>>();

  function keyFor(path: string): string | null {
    return toBuddyRelPath(rootDir, path);
  }

  return {
    capture(path) {
      const relPath = keyFor(path);
      if (!relPath) return;
      const before = readGuarded(resolve(rootDir, relPath));
      if (before) captured.set(relPath, before);
    },

    restore(path) {
      const relPath = keyFor(path);
      if (!relPath) return false;
      const before = captured.get(relPath);
      if (!before) return false;
      captured.delete(relPath); // one capture, one restore

      const absPath = resolve(rootDir, relPath);
      let content: string;
      try {
        content = readFileSync(absPath, "utf8");
      } catch {
        return false;
      }
      const block = /^---\n([\s\S]*?)\n---/.exec(content);
      // A rewrite that removed the frontmatter entirely is a content decision.
      // Re-inserting a block here would be the guard inventing structure.
      if (!block) return false;

      let repaired = false;
      const lines = block[1].split("\n").map((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return line;
        const key = line.slice(0, idx).trim();
        const original = before[key];
        if (original === undefined) return line;
        if (line.slice(idx + 1).trim() === original) return line;
        repaired = true;
        return `${key}: ${original}`;
      });

      if (!repaired) return false;
      writeFileSync(
        absPath,
        `---\n${lines.join("\n")}\n---${content.slice(block[0].length)}`,
        "utf8",
      );
      return true;
    },
  };
}
