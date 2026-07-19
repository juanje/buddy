// shared/ingest-formats.ts — FR-INGEST-04 supported attachment formats.

import { extname } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ""]);

/** True for .md, .txt, or extensionless files (FR-INGEST-04). */
export function isSupportedIngestFormat(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}
