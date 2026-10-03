// src/lib/platform-support-pdf.ts — FR-CHAT-18/21: which platforms expose PDF export.

/** True when the native `create_pdf` command and viewer button should be offered. */
export function platformSupportsPdf(userAgent: string): boolean {
  if (/Windows/i.test(userAgent)) {
    return false;
  }
  return /Mac|macOS|Macintosh|Linux|X11/i.test(userAgent);
}
