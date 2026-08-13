// backends/oauth-callback-host.ts — Windows OAuth callback bind (smoke finding).
//
// Pi's OpenAI Codex browser OAuth redirects to `http://localhost:1455/...` but
// listens on `127.0.0.1` by default (`PI_OAUTH_CALLBACK_HOST`). On Windows,
// browsers often resolve `localhost` to `::1` first. Binding on `::` is a
// best-effort match for that redirect — but it is NOT sufficient alone:
// Hyper-V / WinNAT frequently excludes TCP 1367–1466 (includes 1455), so
// `listen(1455, …)` fails with EACCES and pi-ai's error handler resolves
// waitForCode → null → "Missing authorization code". Prefer device_code on
// Windows (NFR-PORT-10 / OAuthService); keep this bind for any remaining
// browser-callback path.

/** Apply before any OAuth login. Idempotent; does not override an explicit env. */
export function applyWindowsOAuthCallbackHost(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (platform !== "win32") return;
  if (env.PI_OAUTH_CALLBACK_HOST !== undefined) return;
  env.PI_OAUTH_CALLBACK_HOST = "::";
}
