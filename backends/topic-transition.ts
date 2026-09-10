// backends/topic-transition.ts — FR-TOPIC-02 session restart sequencing.
// Extracted from agent-worker so shutdown → dispose → startSession order is
// testable without driving the full RPC entry point.

export interface TopicTransitionDeps {
  hasCore: () => boolean;
  shutdownCore: () => Promise<void>;
  stopHeartbeat: () => void;
  disposeCore: () => void;
  clearCoreRef: () => void;
  onTransitionStart: () => void;
  startSession: (rootDir: string) => Promise<void>;
  rootDir: string;
}

/** Shutdown the live session, notify the frontend, and boot a fresh one. */
export async function runTopicTransition(deps: TopicTransitionDeps): Promise<void> {
  if (!deps.hasCore()) return;
  await deps.shutdownCore();
  deps.stopHeartbeat();
  deps.disposeCore();
  deps.clearCoreRef();
  deps.onTransitionStart();
  await deps.startSession(deps.rootDir);
}

