// backends/deferred.ts — deferred queue parsing (FR-DEFERRED-01).
// Entry format (templates/agent_brain/deferred.md):
//   - **type** (YYYY-MM-DD, source): description.
// Types: reminder | decision | info | review. Sources: daily | weekly |
// monthly | user. Unparseable lines are ignored — the queue is written by
// the LLM during autonomous cycles, so tolerance beats strictness.

import { readFileSync, writeFileSync } from "node:fs";

import { toIsoDay } from "../shared/dates";
import type { DeferredItemView } from "../shared/api";
import { deferredPath } from "./brain-paths";

export interface ParsedDeferredItem {
  type: string;
  dueDate: string; // YYYY-MM-DD
  source: string;
  text: string;
}

// Tolerant: accepts optional time after date (e.g. "2026-07-23 01:56" or "2026-07-23").
const ENTRY_RE = /^-\s+\*\*(\w+)\*\*\s+\((\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?,\s*(\w+)\):\s*(.+)$/;

export function parseDeferredItems(markdown: string): ParsedDeferredItem[] {
  const items: ParsedDeferredItem[] = [];
  for (const line of markdown.split("\n")) {
    const match = ENTRY_RE.exec(line.trim());
    if (match) {
      items.push({ type: match[1], dueDate: match[2], source: match[3], text: match[4].trim() });
    }
  }
  return items;
}

/** Items due on or before `today` (YYYY-MM-DD lexicographic compare works). */
export function dueDeferredItems(
  items: ParsedDeferredItem[],
  today: string,
): ParsedDeferredItem[] {
  return items.filter((item) => item.dueDate <= today);
}

/** Due/overdue deferred items without assembling the full system prompt. */
export function getDueDeferred(rootDir: string, now: Date = new Date()): ParsedDeferredItem[] {
  let deferredRaw: string | undefined;
  try {
    deferredRaw = readFileSync(deferredPath(rootDir), "utf8");
  } catch {
    return [];
  }
  return dueDeferredItems(parseDeferredItems(deferredRaw), toIsoDay(now));
}

/**
 * Remove due/overdue entries from deferred.md (FR-DEFERRED-01 dismiss = acknowledge).
 * Preserves future entries, headers, and non-entry lines.
 */
export function removeDueDeferredItems(rootDir: string, now: Date = new Date()): void {
  const path = deferredPath(rootDir);
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }
  const today = toIsoDay(now);
  const kept = content.split("\n").filter((line) => {
    const match = ENTRY_RE.exec(line.trim());
    if (!match) return true;
    return match[2] > today;
  });
  writeFileSync(path, kept.join("\n"), "utf8");
}

/**
 * Remove specific resolved deferred items from deferred.md (FR-DEFERRED-06).
 *
 * `resolvedText` comes from the reflect fork's `### Resolved deferred`
 * section — one item per line, in whichever format the model reached for:
 * the raw deferred.md entry, the `[type] due date (source): text` form it
 * saw in the session-start context, or just the description text. Matching
 * is on the description only (the part after the `):` prefix, if present),
 * normalized and compared as a substring in both directions — the model may
 * paraphrase or truncate, and a deferred entry may carry more detail than
 * what the model echoes back.
 */
export function removeResolvedDeferredItems(rootDir: string, resolvedText: string): number {
  const path = deferredPath(rootDir);
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return 0;
  }

  const resolvedDescriptions = resolvedText
    .split("\n")
    .map((line) => {
      let text = line.replace(/^-\s*/, "").trim();
      // Strip "[type] due YYYY-MM-DD (source): " prefix (session-context format).
      text = text.replace(/^\[?\w+\]?\s*(?:due\s+)?\d{4}-\d{2}-\d{2}\s*\(\w+\):\s*/i, "");
      // Strip "**type** (YYYY-MM-DD, source): " prefix (deferred.md format).
      text = text.replace(/^\*\*\w+\*\*\s*\(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?,\s*\w+\):\s*/i, "");
      return text.toLowerCase().trim();
    })
    .filter((text) => text.length >= 10);

  if (resolvedDescriptions.length === 0) return 0;

  const lines = content.split("\n");
  let removedCount = 0;
  const kept = lines.filter((line) => {
    const match = ENTRY_RE.exec(line.trim());
    if (!match) return true;
    const entryDescription = match[4].trim().toLowerCase();
    const isResolved = resolvedDescriptions.some(
      (desc) => entryDescription.includes(desc) || desc.includes(entryDescription),
    );
    if (isResolved) {
      removedCount++;
      return false;
    }
    return true;
  });

  if (removedCount > 0) {
    writeFileSync(path, kept.join("\n"), "utf8");
  }
  return removedCount;
}

/** Map parsed deferred items to frontend view models (FR-DEFERRED-01/02). */
export function toDeferredItemViews(
  items: ParsedDeferredItem[],
  today: string,
): DeferredItemView[] {
  return items.map((item) => ({
    type: item.type,
    dueDate: item.dueDate,
    source: item.source,
    text: item.text,
    overdue: item.dueDate < today,
  }));
}
