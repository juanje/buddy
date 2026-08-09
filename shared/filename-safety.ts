// shared/filename-safety.ts — Reject Windows-illegal names before any write
// (NFR-SEC-22 / spike A4).
//
// On NTFS a colon does not fail: it creates an alternate data stream. The
// directory listing shows a 0-byte file; the content is invisible to Buddy's
// own tools. Reserved device names (NUL, CON, …) discard writes with success.
// Both are silent content loss — the failure mode this project already knows.
//
// Enforced on every platform so a memory directory created on Linux cannot
// carry names that become traps when opened on Windows (NFR-PORT-01).

/** Device names reserved by Windows (with or without an extension). */
const RESERVED_DEVICE =
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

/** Characters illegal in a Windows file/folder name (excluding separators). */
const ILLEGAL_CHARS = /[<>:"|?*\u0000-\u001f]/;

/**
 * Why `path` is unsafe to create/write on Windows, or `null` when every
 * segment is legal. Drive letters (`C:`) are ignored; any other `:` is ADS.
 */
export function windowsFilenameIssue(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((part) => part.length > 0);

  for (const part of parts) {
    // Absolute win32 root segment: "C:" from "C:/Users/…"
    if (/^[A-Za-z]:$/.test(part)) continue;

    // "C:foo" (per-drive relative) — treat the name after the drive as the segment.
    let name = part;
    if (/^[A-Za-z]:/.test(part)) {
      name = part.slice(2);
      if (!name) continue;
    }

    if (name.includes(":")) {
      return `Illegal character ':' in filename "${part}" (would create a Windows alternate data stream).`;
    }
    if (ILLEGAL_CHARS.test(name)) {
      return `Illegal character in filename "${part}".`;
    }
    if (RESERVED_DEVICE.test(name)) {
      return `Reserved Windows device name "${part}" (write would be discarded or redirected).`;
    }
    if (/[. ]$/.test(name)) {
      return `Filename "${part}" must not end with a space or period on Windows.`;
    }
  }
  return null;
}
