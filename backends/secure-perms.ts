// backends/secure-perms.ts — Restrictive permissions for ~/.buddy/ (NFR-SEC-17).
//
// On POSIX, `mkdir`/`writeFile` modes (0700/0600) are real. On Windows they are
// not: Node maps them to the read-only attribute at best, and the files stay
// readable by every account on the machine. Silence is the failure mode the
// Windows spike named (A1). Here we apply an explicit ACL via `icacls` so the
// current user (and only that grant we control) owns the path.

import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

export type AclRunner = (path: string, args: string[]) => void;

function defaultIcaclsRunner(targetPath: string, args: string[]): void {
  execFileSync("icacls", [targetPath, ...args], { stdio: "ignore" });
}

/** `DOMAIN\user` when USERDOMAIN is set; otherwise the local username. */
export function windowsAclPrincipal(
  env: NodeJS.ProcessEnv = process.env,
  username: string = userInfo().username,
): string {
  const domain = env.USERDOMAIN?.trim();
  return domain ? `${domain}\\${username}` : username;
}

/**
 * Make `targetPath` non-world-readable on Windows. No-op on POSIX (callers
 * still pass `mode` to `mkdirSync`/`writeFileSync`).
 *
 * Best-effort: a failure to ACL must not crash boot — same posture as
 * `ensureConfigDirMode`'s chmod catch.
 */
export function applyRestrictiveAcl(
  targetPath: string,
  options?: { runner?: AclRunner; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform },
): void {
  const platform = options?.platform ?? process.platform;
  if (platform !== "win32") return;

  const runner = options?.runner ?? defaultIcaclsRunner;
  const principal = windowsAclPrincipal(options?.env);
  try {
    // Grant an *explicit* ACE first, then strip inheritance. Doing inheritance:r
    // first can leave the path with zero ACEs if the subsequent grant fails
    // (icacls applies flags left-to-right within one invocation).
    runner(targetPath, ["/grant:r", `${principal}:(F)`]);
    runner(targetPath, ["/inheritance:r"]);
  } catch {
    // Best effort — do not refuse to start if icacls is unavailable.
    try {
      runner(targetPath, ["/inheritance:e"]);
    } catch {
      // ignore restore failure
    }
  }
}
