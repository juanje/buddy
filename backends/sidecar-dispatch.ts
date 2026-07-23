// backends/sidecar-dispatch.ts — E13b argv routing for compiled sidecar entry.

/** Which module sidecar-entry should boot (testable without loading the full binary). */
export function sidecarBootTarget(argv: string[] = process.argv): "reflect-child" | "agent-worker" {
  return argv[1] === "--reflect" ? "reflect-child" : "agent-worker";
}
