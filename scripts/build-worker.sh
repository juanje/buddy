#!/usr/bin/env bash
# Thin wrapper — logic lives in build-worker.ts so Windows needs no bash (B1–B3).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec npx tsx scripts/build-worker.ts
