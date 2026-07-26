// backends/hebbian.ts — Code-enforced Hebbian access tracking (FR-HEBB).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { toIsoDay } from "../shared/dates";
import { normalizeAbPath } from "../shared/path-utils";
import { parseFrontmatter } from "./reflect";

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
  if (!relPath.startsWith("agent_brain/")) return true;

  if (relPath === "agent_brain/identity/SOUL.md") return true;
  if (relPath === "agent_brain/identity/USER.md") return true;
  if (relPath === "agent_brain/observations.md") return true;
  if (relPath === "agent_brain/deferred.md") return true;
  if (relPath.endsWith("/index.md") || relPath === "agent_brain/index.md") return true;

  const skillsPrefix = "agent_brain/skills/";
  if (relPath.startsWith(skillsPrefix)) {
    const skillName = relPath.slice(skillsPrefix.length);
    if (!skillName.includes("/") && CORE_SKILL_NAMES.has(skillName)) return true;
  }

  return false;
}

function updateAccessFrontmatter(content: string, today: string): string | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/);
  if (!match) return null;

  const fields = parseFrontmatter(content);
  if (!("access_count" in fields)) return null;

  const current = Number.parseInt(fields.access_count, 10);
  const nextCount = Number.isFinite(current) ? current + 1 : 1;

  const lines = match[1].split("\n").map((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return line;
    const key = line.slice(0, idx).trim();
    if (key === "access_count") return `access_count: ${nextCount}`;
    if (key === "last_accessed") return `last_accessed: ${today}`;
    return line;
  });

  const hasLastAccessed = lines.some((line) => line.startsWith("last_accessed:"));
  if (!hasLastAccessed) {
    const accessIdx = lines.findIndex((line) => line.startsWith("access_count:"));
    if (accessIdx >= 0) lines.splice(accessIdx + 1, 0, `last_accessed: ${today}`);
    else lines.push(`last_accessed: ${today}`);
  }

  return `---\n${lines.join("\n")}\n---${match[2]}`;
}

export function createHebbianTracker(rootDir: string): HebbianTracker {
  const sessionReadSet = new Set<string>();
  const pendingUpdates = new Set<string>();

  return {
    trackAccess(path: string): void {
      const relPath = normalizeAbPath(rootDir, path);
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
