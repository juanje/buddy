#!/usr/bin/env bash
# Dev helper: build sidecar if missing (tauri dev warns when externalBin absent).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TRIPLE="$(npx tsx -e "import { resolveSidecarTarget, sidecarOutPath } from './scripts/sidecar-target.ts'; console.log(sidecarOutPath(resolveSidecarTarget()))")"
OUT="${ROOT}/${TRIPLE}"

if [[ -f "${OUT}" ]]; then
  exit 0
fi

echo "Sidecar missing — building ${OUT}…"
npm run build:worker
