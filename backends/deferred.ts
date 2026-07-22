// backends/deferred.ts — deferred queue parsing (FR-DEFERRED-01).
// Entry format (templates/agent_brain/deferred.md):
//   - **type** (YYYY-MM-DD, source): description.
// Types: reminder | decision | info | review. Sources: daily | weekly |
// monthly | user. Unparseable lines are ignored — the queue is written by
// the LLM during autonomous cycles, so tolerance beats strictness.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { toIsoDay } from "../shared/dates";
import type { DeferredItemView } from "../shared/api";

export interface ParsedDeferredItem {
  type: string;
  dueDate: string; // YYYY-MM-DD
  source: string;
  text: string;
}

const ENTRY_RE = /^-\s+\*\*(\w+)\*\*\s+\((\d{4}-\d{2}-\d{2}),\s*(\w+)\):\s*(.+)$/;

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
export function getDueDeferred(abDirectory: string, now: Date = new Date()): ParsedDeferredItem[] {
  let deferredRaw: string | undefined;
  try {
    deferredRaw = readFileSync(join(abDirectory, "agent_brain", "deferred.md"), "utf8");
  } catch {
    return [];
  }
  return dueDeferredItems(parseDeferredItems(deferredRaw), toIsoDay(now));
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

export { toIsoDay } from "../shared/dates";
