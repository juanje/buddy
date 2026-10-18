// tests/unit/photon-wasm.test.ts — FR-INGEST-05 Photon wasm hook.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { installPhotonWasmHook, readPhotonWasmFromPath } from "../../backends/photon-wasm";
import { processImage } from "../../node_modules/@earendil-works/pi-coding-agent/dist/utils/image-process.js";

const ROOT = join(import.meta.dirname, "..", "..");

function photonWasmOnDisk(): string {
  const candidates = [
    join(ROOT, "node_modules", "@silvia-odwyer", "photon-node", "photon_rs_bg.wasm"),
    join(
      ROOT,
      "node_modules",
      "@earendil-works",
      "pi-coding-agent",
      "node_modules",
      "@silvia-odwyer",
      "photon-node",
      "photon_rs_bg.wasm",
    ),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error("photon_rs_bg.wasm not found");
}

// 1×1 PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("installPhotonWasmHook", () => {
  it("serves embedded wasm for a missing path ending in photon_rs_bg.wasm", () => {
    const onDisk = readFileSync(photonWasmOnDisk());
    const fromHook = readPhotonWasmFromPath("/does/not/exist/photon_rs_bg.wasm");
    expect(fromHook.subarray(0, 4)).toEqual(Buffer.from([0, 0x61, 0x73, 0x6d]));
    expect(fromHook.length).toBe(onDisk.length);
  });

  it("allows processImage to resize a small PNG with Photon loaded", async () => {
    installPhotonWasmHook();
    const result = await processImage(TINY_PNG, "image/png", {
      resizeOptions: { maxBytes: 512 * 1024 },
    });
    expect(result.ok).toBe(true);
  });
});
