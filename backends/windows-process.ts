// backends/windows-process.ts — Shared Windows child-process hide options (NFR-PORT-09).
//
// Console-subsystem tools (git, icacls, attrib, cmd) flash a visible console when
// spawned from the GUI-patched agent-worker unless CREATE_NO_WINDOW is set.
// Node/Bun `windowsHide: true` maps to that flag.

/** Windows-only spawn/exec option so short-lived console children stay invisible. */
export function windowsHideSpawnOption(
  platform: NodeJS.Platform = process.platform,
): { windowsHide?: true } {
  return platform === "win32" ? { windowsHide: true } : {};
}
