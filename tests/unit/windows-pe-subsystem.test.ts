// tests/unit/windows-pe-subsystem.test.ts — NFR-PORT-09 / spike C2 PE subsystem patch.

import { describe, expect, it } from "vitest";

import {
  PE_SUBSYSTEM_WINDOWS_CUI,
  PE_SUBSYSTEM_WINDOWS_GUI,
  PeFormatError,
  readPeSubsystem,
  setPeSubsystem,
} from "../../scripts/windows-pe-subsystem";

/** Minimal PE32+ image with a configurable Subsystem field. */
function makeFakePe(subsystem: number): Uint8Array {
  const peOffset = 0x80;
  const buf = new Uint8Array(peOffset + 24 + 96);
  const view = new DataView(buf.buffer);
  view.setUint16(0, 0x5a4d, true); // MZ
  view.setUint32(0x3c, peOffset, true);
  view.setUint32(peOffset, 0x00004550, true); // PE\0\0
  view.setUint16(peOffset + 24, 0x20b, true); // PE32+
  view.setUint16(peOffset + 24 + 68, subsystem, true);
  return buf;
}

describe("PE subsystem helpers", () => {
  it("reads Subsystem from a PE32+ image", () => {
    expect(readPeSubsystem(makeFakePe(PE_SUBSYSTEM_WINDOWS_CUI))).toBe(3);
    expect(readPeSubsystem(makeFakePe(PE_SUBSYSTEM_WINDOWS_GUI))).toBe(2);
  });

  it("patches console (3) to GUI (2)", () => {
    const buf = makeFakePe(PE_SUBSYSTEM_WINDOWS_CUI);
    setPeSubsystem(buf, PE_SUBSYSTEM_WINDOWS_GUI);
    expect(readPeSubsystem(buf)).toBe(PE_SUBSYSTEM_WINDOWS_GUI);
  });

  it("rejects non-MZ buffers", () => {
    expect(() => readPeSubsystem(new Uint8Array(64))).toThrow(PeFormatError);
  });
});
