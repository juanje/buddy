// shared/ingest-formats.ts — FR-INGEST-04 supported attachment formats.

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ""]);

function extname(filePath: string): string {
  const base = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot);
}

/** True for .md, .txt, or extensionless files (FR-INGEST-04). */
export function isSupportedIngestFormat(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}
