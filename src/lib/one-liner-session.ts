// src/lib/one-liner-session.ts — FR-ORIENT-04 one-liner UI state for first open vs topic change.

export interface OneLinerSessionState {
  lastOneLiner: string | null;
  oneLinerFetchedOnce: boolean;
  orientationShownThisSession: boolean;
}

export function createOneLinerSessionState(): OneLinerSessionState {
  return {
    lastOneLiner: null,
    oneLinerFetchedOnce: false,
    orientationShownThisSession: false,
  };
}

export function recordOneLinerReceived(
  state: OneLinerSessionState,
  text: string,
): OneLinerSessionState {
  return {
    ...state,
    lastOneLiner: text,
    oneLinerFetchedOnce: true,
  };
}

export function clearOneLinerOnTopicTransition(
  state: OneLinerSessionState,
): OneLinerSessionState {
  return {
    ...state,
    lastOneLiner: null,
  };
}

/** True when the worker should silently request a recap one-liner. */
export function shouldRequestOneLiner(state: OneLinerSessionState): boolean {
  return (
    state.orientationShownThisSession &&
    state.lastOneLiner === null &&
    !state.oneLinerFetchedOnce
  );
}

/** ChatView shows LastSessionSummary when this is true. */
export function isOneLinerVisible(
  oneLiner: string | null,
  orientationData: unknown,
  messageCount: number,
): boolean {
  return Boolean(oneLiner && !orientationData && messageCount === 0);
}
