// src/utils/dev-log.ts — dev-only diagnostics channel.
// The Tauri webview has no visible console; in dev mode we POST messages to
// the Vite server (/__ab_log middleware) so they appear in the terminal.
// No-op in production builds.

export function devLog(message: string): void {
  if (!import.meta.env.DEV) return;
  void fetch("/__ab_log", { method: "POST", body: message }).catch(() => {
    // Diagnostics only — never let logging break the app.
  });
}

/**
 * Dev-only remote control: receive commands POSTed to the Vite server's
 * /__ab_cmd endpoint (forwarded over the HMR websocket). Used to drive the
 * real app headlessly for smoke tests. No-op in production builds.
 */
export function onDevCommand(handler: (cmd: string) => void): void {
  if (!import.meta.env.DEV || !import.meta.hot) return;
  import.meta.hot.on("ab:cmd", (data) => handler(String(data)));
}

export function installDevErrorReporting(): void {
  if (!import.meta.env.DEV) return;
  window.addEventListener("error", (e) => {
    devLog(`window.onerror: ${e.message} (${e.filename}:${e.lineno})`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    devLog(`unhandledrejection: ${String(e.reason)}`);
  });
}
