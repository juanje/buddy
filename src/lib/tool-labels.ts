// src/lib/tool-labels.ts — human-readable labels for tool activity (FR-CHAT-06).

import type { ToolCallEntry } from "./chat-controller";
import type { LocaleStrings } from "./i18n";
import { basename } from "../utils/path";

export function toolCallLabel(entry: ToolCallEntry, strings: LocaleStrings): string {
  const file = entry.path ? basename(entry.path) : undefined;
  switch (entry.name) {
    case "read":
      return file ? strings.toolReadingFile.replace("{file}", file) : strings.toolReading;
    case "write":
    case "edit":
      return file ? strings.toolWritingFile.replace("{file}", file) : strings.toolWriting;
    case "grep":
    case "find":
      return strings.toolSearching;
    case "ls":
      return strings.toolListing;
    default:
      return strings.toolRunning.replace("{tool}", entry.name);
  }
}

export function toolActivitySummary(calls: ToolCallEntry[], strings: LocaleStrings): string {
  if (calls.length === 0) return strings.toolWorking;

  const reads = calls.filter((c) => c.name === "read");
  const writes = calls.filter((c) => c.name === "write" || c.name === "edit");
  const searches = calls.filter((c) => c.name === "grep" || c.name === "find");

  if (reads.length > 0 && writes.length === 0 && searches.length === 0) {
    return reads.length === 1
      ? toolCallLabel(reads[0], strings)
      : strings.toolReadCount.replace("{count}", String(reads.length));
  }
  if (writes.length > 0 && reads.length === 0 && searches.length === 0) {
    return writes.length === 1
      ? toolCallLabel(writes[0], strings)
      : strings.toolWriteCount.replace("{count}", String(writes.length));
  }
  if (searches.length > 0 && reads.length === 0 && writes.length === 0) {
    return strings.toolSearching;
  }

  const running = calls.some((c) => c.status === "running");
  return running ? strings.toolWorking : strings.toolUsedCount.replace("{count}", String(calls.length));
}
