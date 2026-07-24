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

# Remove the old app
echo "[+] Remove the old Buddy.app"
rm -fr "${APP_DIR}" 

if [[ ! -d  "${NEW_APP}" ]] ; then
  echo "[-] The ${NEW_APP} dir doesn't exist. Probably the build failed"
fi

# Install the new one
echo "[+] Install the app (copy it to /Applications/"
cp -r "${NEW_APP}" "/Applications/${APP_NAME}"

echo "[+] App Buddy succesfully reinstalled"
