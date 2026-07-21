// shared/ingest-formats.ts — FR-INGEST-04/05 supported attachment formats.

const TEXT_EXTENSIONS = new Set([".md", ".txt", ""]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, ...PDF_EXTENSIONS]);

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

/** Map file extension to MIME type for images. */
export function imageMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
}
