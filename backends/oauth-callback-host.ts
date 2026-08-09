// backends/oauth-callback-host.ts — Windows OAuth callback bind (smoke finding).
//
// Pi's OpenAI Codex OAuth redirects to `http://localhost:1455/...` but listens
// on `127.0.0.1` by default (`PI_OAUTH_CALLBACK_HOST`). On Windows, browsers
// often resolve `localhost` to `::1` first → ERR_CONNECTION_REFUSED while the
// IPv4 socket sits idle, then Buddy surfaces "Missing authorization code".
// Binding the callback on `::` (dual-stack where the OS allows) matches the
// redirect host the IdP already registered.

/** Apply before any OAuth login. Idempotent; does not override an explicit env. */
export function applyWindowsOAuthCallbackHost(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (platform !== "win32") return;
  if (env.PI_OAUTH_CALLBACK_HOST !== undefined) return;
  env.PI_OAUTH_CALLBACK_HOST = "::";
}
