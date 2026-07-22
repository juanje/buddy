#!/usr/bin/env bash
# Dev helper: build sidecar if missing (tauri dev warns when externalBin absent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="$(rustc -vV | grep host | cut -d' ' -f2)"
OUT="src-tauri/binaries/agent-worker-${TARGET}"

if [[ -x "${OUT}" ]]; then
  exit 0
fi

echo "Sidecar missing — building ${OUT}…"
bash scripts/build-worker.sh
