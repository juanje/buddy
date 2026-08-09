// scripts/sidecar-target.ts — Resolve the Rust target triple used to name the
// Tauri sidecar (spike B1–B2). Pure helpers so tests pin Windows mapping without
// invoking rustc.

import { execFileSync } from "node:child_process";

/** Rust host triple from `rustc -vV`, or null when rustc is unavailable. */
export function rustcHostTriple(
  run: () => string = () => execFileSync("rustc", ["-vV"], { encoding: "utf8" }),
): string | null {
  try {
    const match = /^host:\s*(\S+)/m.exec(run());
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fallback when rustc is not on PATH (common on a fresh Windows machine before
 * the Rust toolchain is installed for `tauri build`).
 */
export function platformFallbackTriple(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  if (platform === "win32") {
    if (arch === "arm64") return "aarch64-pc-windows-msvc";
    return "x86_64-pc-windows-msvc";
  }
  if (platform === "darwin") {
    if (arch === "arm64") return "aarch64-apple-darwin";
    return "x86_64-apple-darwin";
  }
  if (arch === "arm64") return "aarch64-unknown-linux-gnu";
  return "x86_64-unknown-linux-gnu";
}

/** Bun `--target=` flag for cross-compile, or "" for native compile. */
export function bunTargetFlag(rustTriple: string): string {
  switch (rustTriple) {
    case "x86_64-apple-darwin":
      return "--target=bun-darwin-x64";
    case "aarch64-apple-darwin":
      return "--target=bun-darwin-arm64";
    case "x86_64-unknown-linux-gnu":
      return "--target=bun-linux-x64";
    case "aarch64-unknown-linux-gnu":
      return "--target=bun-linux-arm64";
    case "x86_64-pc-windows-msvc":
      return "--target=bun-windows-x64";
    case "aarch64-pc-windows-msvc":
      return "--target=bun-windows-arm64";
    default:
      return "";
  }
}

/**
 * Sidecar outfile relative to repo root. Tauri expects
 * `agent-worker-<triple>` and, on Windows, a `.exe` suffix.
 */
export function sidecarOutPath(rustTriple: string): string {
  const base = `src-tauri/binaries/agent-worker-${rustTriple}`;
  return rustTriple.includes("windows") ? `${base}.exe` : base;
}

/** Resolve the triple: env override → rustc → platform fallback. */
export function resolveSidecarTarget(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  const fromEnv = env.BUDDY_BUILD_TARGET?.trim();
  if (fromEnv) return fromEnv;
  return rustcHostTriple() ?? platformFallbackTriple(platform, arch);
}
