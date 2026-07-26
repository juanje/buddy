// backends/sidecar-entry.ts — Entry point for the compiled sidecar binary.
// Polyfills browser globals that pdfjs-dist (via pdf-parse) expects at module
// load time. These stubs are never exercised for actual rendering — they just
// prevent the ReferenceError crash on startup.
//
// IMPORTANT: uses dynamic import so polyfills are installed before any
// dependency module-level code executes (static imports are hoisted in ESM).
//
// OAuth flows and the undici dispatcher are wired statically below because
// Pi loads them through bundler-opaque dynamic imports (variable specifiers)
// that cannot resolve inside a bun-compiled binary — the files aren't on disk.
// Without registerBunOAuthFlows(), every OAuth-authenticated prompt fails with
// "OAuth auth derivation failed for <provider>" and the chat shows no reply.
// This mirrors Pi's own standalone bun binary (pi/src/bun/cli.ts). The deep
// relative paths bypass package export maps on purpose: pi-ai is a nested
// dependency of pi-coding-agent and neither exports these entry points to us.

import { registerBunOAuthFlows } from "../node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/bun-oauth.js";
import { configureHttpDispatcher } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/http-dispatcher.js";
import { registerEmbeddedAssets } from "./embedded-assets";
import { EMBEDDED_APP_VERSION, EMBEDDED_DOCS, EMBEDDED_PDF_WORKER, EMBEDDED_PROMPTS, EMBEDDED_TEMPLATES } from "./embedded-assets.generated";
import { sidecarBootTarget } from "./sidecar-dispatch";

(globalThis as any).DOMMatrix = class DOMMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  m11 = 1; m12 = 0; m13 = 0; m14 = 0;
  m21 = 0; m22 = 1; m23 = 0; m24 = 0;
  m31 = 0; m32 = 0; m33 = 1; m34 = 0;
  m41 = 0; m42 = 0; m43 = 0; m44 = 1;
  is2D = true; isIdentity = true;
  inverse() { return new (globalThis as any).DOMMatrix(); }
  multiply() { return new (globalThis as any).DOMMatrix(); }
  scale() { return new (globalThis as any).DOMMatrix(); }
  translate() { return new (globalThis as any).DOMMatrix(); }
  transformPoint(p: any) { return p ?? { x: 0, y: 0, z: 0, w: 1 }; }
};

(globalThis as any).ImageData = class ImageData {
  width: number; height: number; data: Uint8ClampedArray;
  constructor(w = 0, h = 0) {
    this.width = w; this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
};

(globalThis as any).Path2D = class Path2D {
  moveTo() {} lineTo() {} closePath() {} rect() {}
  arc() {} arcTo() {} ellipse() {} bezierCurveTo() {}
  quadraticCurveTo() {}
};

registerBunOAuthFlows();
configureHttpDispatcher();

// Templates and bundled prompts live in the repo tree, which doesn't exist
// inside the compiled binary — register the build-time snapshot instead.
registerEmbeddedAssets({ templates: EMBEDDED_TEMPLATES, prompts: EMBEDDED_PROMPTS, docs: EMBEDDED_DOCS, appVersion: EMBEDDED_APP_VERSION, pdfWorker: EMBEDDED_PDF_WORKER });

// E13b: same binary, two modes — worker RPC vs one-shot reflect child.
if (sidecarBootTarget() === "reflect-child") {
  await import("./reflect-child");
} else {
  await import("./agent-worker");
}
