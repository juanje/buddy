// tests/unit/sidecar-imports.test.ts — FR-SDK-03 sidecar deep import guard.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

const SIDECAR_IMPORT_PATHS = {
  bunOAuth: join(
    ROOT,
    "node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/bun-oauth.js",
  ),
  httpDispatcher: join(
    ROOT,
    "node_modules/@earendil-works/pi-coding-agent/dist/core/http-dispatcher.js",
  ),
} as const;

describe("FR-SDK-03 sidecar deep import paths", () => {
  it("bun-oauth.js exists at the path sidecar-entry imports", () => {
    expect(existsSync(SIDECAR_IMPORT_PATHS.bunOAuth)).toBe(true);
  });

  it("http-dispatcher.js exists at the path sidecar-entry imports", () => {
    expect(existsSync(SIDECAR_IMPORT_PATHS.httpDispatcher)).toBe(true);
  });
});
