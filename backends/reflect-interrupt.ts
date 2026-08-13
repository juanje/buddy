// backends/reflect-interrupt.ts — Portable interrupt commit for reflect-child
// (NFR-REL-11 / spike A9).
//
// The previous handler listened only for SIGTERM and shelled out through
// `execSync` with POSIX single quotes — dead on Windows (no real SIGTERM from
// Task Manager), and racy on every OS because it bypassed `commitAll`'s lock
// (FR-REFLECT-06).

import { GIT_COMMIT_PREFIX } from "../shared/defaults";
import { commitAll } from "./git";

export type InterruptCommit = (rootDir: string, signal: string) => Promise<void>;

/** Commit message for an interrupted reflect — no shell quoting required. */
export function reflectInterruptedMessage(signal: string): string {
  return `${GIT_COMMIT_PREFIX} reflect interrupted (${signal})`;
}

/**
 * Best-effort commit of agent writes when the reflect child is interrupted.
 * Uses `commitAll` so the worker and child cannot race `.git/index.lock`.
 */
export async function commitReflectInterrupted(
  rootDir: string,
  signal: string,
): Promise<void> {
  try {
    await commitAll(rootDir, reflectInterruptedMessage(signal));
  } catch {
    // Best effort — exiting is more important than a perfect commit.
  }
}

/** Signals Buddy registers for a portable interrupt path (NFR-REL-11). */
export function reflectInterruptSignals(
  platform: NodeJS.Platform = process.platform,
): NodeJS.Signals[] {
  // SIGBREAK is the Windows Ctrl+Break analogue; SIGINT covers Ctrl+C.
  // SIGTERM remains for process.kill from the worker / parent Node.
  if (platform === "win32") return ["SIGINT", "SIGTERM", "SIGBREAK"];
  return ["SIGINT", "SIGTERM"];
}

/**
 * Install interrupt handlers that commit via `commitAll` then exit.
 * Returns a disposer that removes the listeners (for tests).
 */
export function installReflectInterruptHandlers(
  rootDir: string,
  options?: {
    signals?: NodeJS.Signals[];
    commit?: InterruptCommit;
    exit?: (code: number) => void;
  },
): () => void {
  const signals = options?.signals ?? reflectInterruptSignals();
  const commit = options?.commit ?? commitReflectInterrupted;
  const exit = options?.exit ?? ((code: number) => process.exit(code));
  let exiting = false;
  // Node's signal listeners receive no args — close over the name per handler.
  const handlers: Array<[NodeJS.Signals, () => void]> = [];

  for (const signal of signals) {
    const handler = () => {
      if (exiting) return;
      exiting = true;
      void commit(rootDir, signal).finally(() => exit(0));
    };
    handlers.push([signal, handler]);
    process.on(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler);
    }
  };
}
