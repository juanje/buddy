// backends/hebbian.ts — Code-enforced Hebbian access tracking (FR-HEBB).

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { toIsoDay } from "../shared/dates";
import { toBuddyRelPath } from "../shared/path-utils";
import { matchFrontmatterBlock, parseFrontmatter } from "../shared/frontmatter";
import { BRAIN, BRAIN_PREFIX, BRAIN_SUBDIRS, INDEX_SUFFIX, dirPrefix } from "../shared/brain-paths";

export interface HebbianTracker {
  trackAccess(path: string): void;
  /** Apply queued frontmatter updates. Returns true if any file was written. */
  flush(): boolean;
}

const CORE_SKILL_NAMES = new Set([
  "process-conversation.md",
  "daily-consolidation.md",
  "weekly-review.md",
  "monthly-maintenance.md",
  "triage-inbox.md",
  "update-upstream.md",
]);

function isExcluded(relPath: string): boolean {
  if (!relPath.startsWith(BRAIN_PREFIX)) return true;

  if (relPath === BRAIN.soul) return true;
  if (relPath === BRAIN.user) return true;
  if (relPath === BRAIN.observations) return true;
  if (relPath === BRAIN.deferred) return true;
  if (relPath.endsWith(INDEX_SUFFIX) || relPath === BRAIN.index) return true;

  const skillsPrefix = dirPrefix(BRAIN_SUBDIRS.skills);
  if (relPath.startsWith(skillsPrefix)) {
    const skillName = relPath.slice(skillsPrefix.length);
    if (!skillName.includes("/") && CORE_SKILL_NAMES.has(skillName)) return true;
  }

  return false;
}

/**
 * Record one access, creating the tracking fields when absent (FR-HEBB-05).
 *
 * **Why creating them matters.** This used to `return null` for any file
 * without `access_count`, while `consolidation.md` tells the model it must
 * "never write access_count or last_accessed fields — the worker updates those
 * automatically". Between the two rules nobody created them: a concept the
 * agent distilled was born without the fields and could never acquire them, so
 * it scored zero for ever and every consolidation demoted it. Promotion could
 * only favour files that arrived carrying a history from somewhere else, and on
 * a fresh install — where nothing has the fields — the layer did nothing at all.
 *
 * Bootstrapping on read is what makes this self-repairing: an existing brain
 * heals file by file as it is used, with no migration and nothing rewritten
 * that nobody consults.
 *
 * Returns null only for a file with no frontmatter at all. Adding a whole block
 * would mean inventing a `summary`, which is judgment and belongs to
 * consolidation; the brain health report lists those separately.
 */
export function updateAccessFrontmatter(content: string, today: string): string | null {
  // NFR-PORT-06 / review D6: one frontmatter authority (shared/frontmatter.ts).
  const match = matchFrontmatterBlock(content);
  if (!match) return null;

  const fields = parseFrontmatter(content);
  // A file read for the first time starts at 1, not 0: this read is worth as
  // much as any other, and starting at zero would discard it.
  const current = Number.parseInt(fields.access_count ?? "", 10);
  const nextCount = Number.isFinite(current) ? current + 1 : 1;

  const lines = match[1].split(/\r?\n/).map((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return line;
    const key = line.slice(0, idx).trim();
    if (key === "access_count") return `access_count: ${nextCount}`;
    if (key === "last_accessed") return `last_accessed: ${today}`;
    return line;
  });

  if (!lines.some((line) => line.startsWith("access_count:"))) {
    lines.push(`access_count: ${nextCount}`);
  }

  const hasLastAccessed = lines.some((line) => line.startsWith("last_accessed:"));
  if (!hasLastAccessed) {
    const accessIdx = lines.findIndex((line) => line.startsWith("access_count:"));
    if (accessIdx >= 0) lines.splice(accessIdx + 1, 0, `last_accessed: ${today}`);
    else lines.push(`last_accessed: ${today}`);
  }

  const body = content.slice(match[0].length);
  return `---\n${lines.join("\n")}\n---${body}`;
}

export function createHebbianTracker(rootDir: string): HebbianTracker {
  const sessionReadSet = new Set<string>();
  const pendingUpdates = new Set<string>();

  return {
    trackAccess(path: string): void {
      const relPath = toBuddyRelPath(rootDir, path);
      if (!relPath) return;
      if (isExcluded(relPath)) return;
      if (sessionReadSet.has(relPath)) return;

      sessionReadSet.add(relPath);
      pendingUpdates.add(relPath);
    },

    flush(): boolean {
      if (pendingUpdates.size === 0) return false;

      const today = toIsoDay(new Date());
      let wrote = false;

      for (const relPath of pendingUpdates) {
        const absPath = resolve(rootDir, relPath);
        if (!existsSync(absPath)) continue;

        const content = readFileSync(absPath, "utf8");
        const updated = updateAccessFrontmatter(content, today);
        if (!updated || updated === content) continue;

        writeFileSync(absPath, updated, "utf8");
        wrote = true;
      }

      pendingUpdates.clear();
      return wrote;
    },
  };
}

/**
 * True when a tool call is a *consultation of a specific file* (FR-HEBB-07).
 *
 * `read` is the obvious case. `grep` counts too when it targets one file:
 * searching inside a document is how the agent consults it, and it is the
 * cheaper way to do so — a model that greps a file instead of reading it whole
 * has still used that file, and charging it nothing would push the signal
 * towards whichever tool happens to be less efficient.
 *
 * A `grep` over a directory does not count. That is brute force, not
 * consultation: it says nothing about which files matter, and crediting every
 * file under a tree for one recursive search would drown the real signal.
 */
export function isFileConsultation(
  name: string,
  path: string | undefined,
  rootDir: string,
): boolean {
  if (!path) return false;
  if (name === "read") return true;
  if (name !== "grep") return false;

  try {
    return statSync(resolve(rootDir, path)).isFile();
  } catch {
    return false; // vanished, or never existed: nothing to credit
  }
}
