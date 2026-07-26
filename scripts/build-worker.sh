#!/usr/bin/env bash
# E12 — compile agent-worker as a Tauri sidecar (bun build --compile).
# Supports cross-compilation via BUDDY_BUILD_TARGET env var (Rust target triple).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Determine target triple: env override or detect from host
if [[ -n "${BUDDY_BUILD_TARGET:-}" ]]; then
  SIDECAR_TARGET="$BUDDY_BUILD_TARGET"
else
  # shellcheck source=sidecar-target.sh
  source "${ROOT}/scripts/sidecar-target.sh"
fi

# Map Rust target triple → bun cross-compile target flag
BUN_TARGET_FLAG=""
case "$SIDECAR_TARGET" in
  x86_64-apple-darwin)    BUN_TARGET_FLAG="--target=bun-darwin-x64" ;;
  aarch64-apple-darwin)   BUN_TARGET_FLAG="--target=bun-darwin-arm64" ;;
  x86_64-unknown-linux-gnu) BUN_TARGET_FLAG="--target=bun-linux-x64" ;;
  aarch64-unknown-linux-gnu) BUN_TARGET_FLAG="--target=bun-linux-arm64" ;;
esac

OUT_DIR="src-tauri/binaries"
OUT="${OUT_DIR}/agent-worker-${SIDECAR_TARGET}"
BUN="${ROOT}/node_modules/.bin/bun"

mkdir -p "${OUT_DIR}"

echo "Snapshotting embedded assets (templates + prompts)…"
"${BUN}" scripts/generate-embedded-assets.ts

echo "Compiling worker sidecar for ${SIDECAR_TARGET}…"
# shellcheck disable=SC2086
"${BUN}" build --compile ${BUN_TARGET_FLAG} backends/sidecar-entry.ts --outfile "${OUT}"
chmod +x "${OUT}"

echo "Sidecar ready: ${OUT}"
