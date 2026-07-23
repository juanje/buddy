#!/usr/bin/env bash
# Dev helper: build sidecar if missing (tauri dev warns when externalBin absent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=sidecar-target.sh
source "${ROOT}/scripts/sidecar-target.sh"
OUT="src-tauri/binaries/agent-worker-${SIDECAR_TARGET}"

if [[ -x "${OUT}" ]]; then
  exit 0
fi

echo "Sidecar missing — building ${OUT}…"
bash scripts/build-worker.sh
