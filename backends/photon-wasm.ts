// backends/photon-wasm.ts — FR-INGEST-05 compiled sidecar Photon wasm hook.
//
// Pi 1.x loads photon_rs_bg.wasm via fs.readFileSync at a path baked into the
// bundle. That file is not shipped next to the compiled sidecar binary, so image
// resize fails in production. The wasm bytes are embedded at build time; this
// hook serves them for any read whose path ends with photon_rs_bg.wasm.

import fs from "node:fs";

import { EMBEDDED_PHOTON_WASM } from "./embedded-assets.generated";

const wasmBytes = Buffer.from(EMBEDDED_PHOTON_WASM, "base64");

let installed = false;
let originalReadFileSync: typeof fs.readFileSync | undefined;

function photonWasmBytesForPath(path: fs.PathOrFileDescriptor): Buffer | undefined {
  if (typeof path === "string" && path.endsWith("photon_rs_bg.wasm")) {
    return wasmBytes;
  }
  return undefined;
}

export function installPhotonWasmHook(): void {
  if (installed) return;
  installed = true;
  originalReadFileSync = fs.readFileSync;
  fs.readFileSync = function readFileSyncWithPhotonWasm(path, ...args) {
    const embedded = photonWasmBytesForPath(path);
    if (embedded) return embedded;
    return originalReadFileSync!(path, ...args);
  } as typeof fs.readFileSync;
}

/** Test helper: read wasm through the same hook the sidecar installs. */
export function readPhotonWasmFromPath(path: string): Buffer {
  installPhotonWasmHook();
  return fs.readFileSync(path) as Buffer;
}
