// backends/with-timeout.ts — bound a promise that takes no abort signal.

/**
 * Reject after `timeoutMs` rather than waiting on `promise` forever.
 *
 * The underlying work is not cancelled — it is abandoned, and its result
 * ignored. Only use this where giving up on the request loses nothing.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The provider did not respond in time.")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
