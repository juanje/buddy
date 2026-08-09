#!/usr/bin/env node
// scripts/build-worker.ts — Compile agent-worker as a Tauri sidecar (E12 / B1–B3).
// Replaces the bash-only entry so `npm run build:worker` works on stock Windows.

import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bunTargetFlag,
  resolveSidecarTarget,
  sidecarOutPath,
} from "./sidecar-target";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function bunBin(): string {
  const local = join(
    ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "bun.cmd" : "bun",
  );
  return local;
}

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const target = resolveSidecarTarget();
const outRel = sidecarOutPath(target);
const outAbs = join(ROOT, outRel);
const flag = bunTargetFlag(target);
const bun = bunBin();

mkdirSync(dirname(outAbs), { recursive: true });

console.log("Snapshotting embedded assets (templates + prompts)…");
run(bun, ["scripts/generate-embedded-assets.ts"]);

console.log(`Compiling worker sidecar for ${target}…`);
const buildArgs = ["build", "--compile"];
if (flag) buildArgs.push(flag);
buildArgs.push("backends/sidecar-entry.ts", "--outfile", outRel);
run(bun, buildArgs);

if (process.platform !== "win32") {
  try {
    chmodSync(outAbs, 0o755);
  } catch {
    // Best effort — Windows has no POSIX +x.
  }
}

console.log(`Sidecar ready: ${outRel}`);
