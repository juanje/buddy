#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Buddy.app"
NEW_APP="src-tauri/target/release/bundle/macos/${APP_NAME}"
APP_DIR="/Applications/${APP_NAME}/"

# Run the tests
echo "[+] Run tests"
npm run test

# Build the worker
echo "[+] Build worker"
npm run build:worker

# Build the frontend
echo "[+] Build app (frontend)"
npm run tauri build

