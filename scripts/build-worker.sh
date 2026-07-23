#!/usr/bin/env bash
# E12 — compile agent-worker as a Tauri sidecar (bun build --compile).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=sidecar-target.sh
source "${ROOT}/scripts/sidecar-target.sh"
OUT_DIR="src-tauri/binaries"
OUT="${OUT_DIR}/agent-worker-${SIDECAR_TARGET}"
BUN="${ROOT}/node_modules/.bin/bun"

mkdir -p "${OUT_DIR}"

echo "Snapshotting embedded assets (templates + prompts)…"
"${BUN}" scripts/generate-embedded-assets.ts

echo "Compiling worker sidecar with bun…"
"${BUN}" build --compile backends/sidecar-entry.ts --outfile "${OUT}"
chmod +x "${OUT}"

echo "Sidecar ready: ${OUT}"
