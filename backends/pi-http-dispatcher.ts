// backends/pi-http-dispatcher.ts — Align global fetch on Pi's undici dispatcher.

export async function alignHttpDispatcherWithPi(): Promise<void> {
  try {
    const entryUrl = import.meta.resolve("@earendil-works/pi-coding-agent");
    const dispatcherUrl = entryUrl.replace(/dist\/index\.js$/, "dist/core/http-dispatcher.js");
    const { configureHttpDispatcher } = await import(dispatcherUrl);
    configureHttpDispatcher();
  } catch {
    // Non-fatal: Node < 26 or future Pi version may not need this.
  }
}
