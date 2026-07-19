// backends/prereqs.ts — System prerequisites check (FR-SETUP-02).
// The exec function is injectable so tests never probe real binaries.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { PrereqStatus } from "../shared/api";

export type ExecFn = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

const defaultExec: ExecFn = promisify(execFile);

export async function checkPrerequisites(exec: ExecFn = defaultExec): Promise<PrereqStatus> {
  try {
    const { stdout } = await exec("git", ["--version"]);
    return {
      gitInstalled: true,
      gitVersion: stdout.trim(),
      platform: process.platform,
    };
  } catch {
    // Command not found (or git broken enough to fail --version): same answer
    // for the wizard — git is not usable on this system.
    return { gitInstalled: false, platform: process.platform };
  }
}
