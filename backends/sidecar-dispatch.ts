// backends/sidecar-dispatch.ts — E13b argv routing for compiled sidecar entry.

/**
 * Which module sidecar-entry should boot (testable without loading the full binary).
 *
 * Searches argv broadly (not just [1]) because Bun compiled binaries may
 * prepend extra entries (e.g. runtime path) before user-supplied args.
 */
export function sidecarBootTarget(argv: string[] = process.argv): "reflect-child" | "agent-worker" {
  return argv.includes("--reflect") ? "reflect-child" : "agent-worker";
}
