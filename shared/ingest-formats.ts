// shared/ingest-formats.ts — FR-INGEST-04/05 supported attachment formats.

export type RejectionReason = "spreadsheet" | "document" | "unknown";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".log"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, ...PDF_EXTENSIONS]);

const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xls", ".ods"]);
const DOCUMENT_EXTENSIONS = new Set([".docx", ".pptx", ".epub"]);

function extname(filePath: string): string {
  const base = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot);
}

/** True for text or image formats that the app can handle. */
export function isSupportedIngestFormat(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/** True for image formats that should be sent inline as vision content. */
export function isImageFormat(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/** True for PDF files that need local text extraction before prompt injection. */
export function isPdfFormat(filePath: string): boolean {
  return PDF_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/** True when `ext` is a supported image extension (include leading dot). */
export function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

/** Map file extension to MIME type for images. */
export function imageMimeTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

/** Map file path extension to MIME type for images. */
export function imageMimeType(filePath: string): string {
  return imageMimeTypeFromExt(extname(filePath));
}

/** Why a file was rejected — drives locale-specific UI messages. */
export function rejectionReasonForPath(filePath: string): RejectionReason {
  const ext = extname(filePath).toLowerCase();
  if (SPREADSHEET_EXTENSIONS.has(ext)) return "spreadsheet";
  if (DOCUMENT_EXTENSIONS.has(ext)) return "document";
  return "unknown";
}
