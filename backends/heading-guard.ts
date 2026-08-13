// backends/heading-guard.ts — FR-GUARD-01: heading-snapshot guard.
//
// Captures headings (`#`/`##`) and frontmatter presence before a write/edit,
// restores the file if any heading disappeared or frontmatter was stripped.
// Same capture/check pattern as hebbian-guard.ts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { toBuddyRelPath } from "../shared/path-utils";
import { BRAIN_DIR, LOGS_DIR } from "../shared/brain-paths";
import { hasFrontmatterBlock } from "../shared/frontmatter";

export interface HeadingGuardResult {
  reverted: boolean;
  lostHeadings?: string[];
}

export interface HeadingGuard {
  capture(path: string): void;
  check(path: string): HeadingGuardResult;
}

function extractHeadings(content: string): string[] {
  return content.split("\n")
    .filter((line) => line.startsWith("# ") || line.startsWith("## "))
    .map((line) => {
      if (line.startsWith("## ")) return line.slice(3).trim();
      return line.slice(2).trim();
    });
}

function hasFrontmatter(content: string): boolean {
  // NFR-PORT-06: same CRLF-tolerant authority as parseFrontmatter.
  return hasFrontmatterBlock(content);
}

function isGuardedPath(relPath: string): boolean {
  return relPath.startsWith(`${BRAIN_DIR}/`) || relPath.startsWith(`${LOGS_DIR}/`);
}

export function createHeadingGuard(rootDir: string): HeadingGuard {
  const snapshots = new Map<string, { headings: string[]; hadFrontmatter: boolean; content: string }>();

  return {
    capture(path: string) {
      const relPath = toBuddyRelPath(rootDir, path);
      if (!relPath || !isGuardedPath(relPath)) return;
      const absPath = resolve(rootDir, relPath);
      if (!existsSync(absPath)) return;
      let content: string;
      try {
        content = readFileSync(absPath, "utf8");
      } catch {
        return;
      }
      snapshots.set(relPath, {
        headings: extractHeadings(content),
        hadFrontmatter: hasFrontmatter(content),
        content,
      });
    },

    check(path: string): HeadingGuardResult {
      const relPath = toBuddyRelPath(rootDir, path);
      if (!relPath) return { reverted: false };
      const snapshot = snapshots.get(relPath);
      if (!snapshot) return { reverted: false };
      snapshots.delete(relPath);

      const absPath = resolve(rootDir, relPath);
      let currentContent: string;
      try {
        currentContent = readFileSync(absPath, "utf8");
      } catch {
        return { reverted: false };
      }

      const currentHeadings = extractHeadings(currentContent);
      const lost = snapshot.headings.filter((h) => !currentHeadings.includes(h));
      const frontmatterStripped = snapshot.hadFrontmatter && !hasFrontmatter(currentContent);

      if (lost.length === 0 && !frontmatterStripped) return { reverted: false };

      writeFileSync(absPath, snapshot.content, "utf8");
      return { reverted: true, lostHeadings: lost };
    },
  };
}
