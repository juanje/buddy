#!/usr/bin/env bash
# E12 — compile agent-worker as a Tauri sidecar (bun build --compile).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="$(rustc -vV | grep host | cut -d' ' -f2)"
OUT_DIR="src-tauri/binaries"
OUT="${OUT_DIR}/agent-worker-${TARGET}"
BUN="${ROOT}/node_modules/.bin/bun"

mkdir -p "${OUT_DIR}"

echo "Compiling worker sidecar with bun…"
"${BUN}" build --compile backends/agent-worker.ts --outfile "${OUT}"
chmod +x "${OUT}"

echo "Sidecar ready: ${OUT}"
