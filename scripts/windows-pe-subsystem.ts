// scripts/windows-pe-subsystem.ts — Set PE subsystem on a Windows .exe (NFR-PORT-09 / C2).
//
// Bun 1.3.x documents `--windows-hide-console` but still emits IMAGE_SUBSYSTEM_WINDOWS_CUI
// (verified on WHITEBEAST). tauri-plugin-js has no CREATE_NO_WINDOW, so a console-subsystem
// sidecar opens a persistent black console. Patching to WINDOWS_GUI matches the main app
// (`windows_subsystem = "windows"`). Stdio remains piped by the parent (Tauri / Node spawn).

import { readFileSync, writeFileSync } from "node:fs";

/** IMAGE_SUBSYSTEM_WINDOWS_GUI */
export const PE_SUBSYSTEM_WINDOWS_GUI = 2;
/** IMAGE_SUBSYSTEM_WINDOWS_CUI */
export const PE_SUBSYSTEM_WINDOWS_CUI = 3;

const PE_SIG = 0x00004550; // "PE\0\0"

export class PeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeFormatError";
  }
}

/** Read the OptionalHeader.Subsystem field from a PE image buffer. */
export function readPeSubsystem(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 0x40 || view.getUint16(0, true) !== 0x5a4d) {
    throw new PeFormatError("not an MZ executable");
  }
  const peOffset = view.getUint32(0x3c, true);
  if (peOffset + 24 + 70 > bytes.length) {
    throw new PeFormatError("PE header truncated");
  }
  if (view.getUint32(peOffset, true) !== PE_SIG) {
    throw new PeFormatError("missing PE signature");
  }
  const optOffset = peOffset + 24;
  const magic = view.getUint16(optOffset, true);
  if (magic !== 0x10b && magic !== 0x20b) {
    throw new PeFormatError(`unsupported optional-header magic 0x${magic.toString(16)}`);
  }
  // Subsystem is at the same offset in PE32 and PE32+ optional headers.
  return view.getUint16(optOffset + 68, true);
}

/** Mutate OptionalHeader.Subsystem in-place. */
export function setPeSubsystem(bytes: Uint8Array, subsystem: number): void {
  const current = readPeSubsystem(bytes); // validates layout
  void current;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const peOffset = view.getUint32(0x3c, true);
  const optOffset = peOffset + 24;
  view.setUint16(optOffset + 68, subsystem, true);
}

/**
 * Rewrite a Windows .exe so it uses the GUI subsystem (no console window on launch).
 * Idempotent when already GUI.
 */
export function patchExeToWindowsGui(exePath: string): {
  before: number;
  after: number;
} {
  const buf = new Uint8Array(readFileSync(exePath));
  const before = readPeSubsystem(buf);
  if (before !== PE_SUBSYSTEM_WINDOWS_GUI) {
    setPeSubsystem(buf, PE_SUBSYSTEM_WINDOWS_GUI);
    writeFileSync(exePath, buf);
  }
  const after = readPeSubsystem(new Uint8Array(readFileSync(exePath)));
  return { before, after };
}
