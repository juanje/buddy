// tests/unit/sidecar-target.test.ts — spike B1/B2 Windows sidecar naming.

import { describe, expect, it } from "vitest";

import {
  bunTargetFlag,
  platformFallbackTriple,
  resolveSidecarTarget,
  sidecarOutPath,
} from "../../scripts/sidecar-target";

describe("bunTargetFlag", () => {
  it("maps the Windows MSVC triples (B1)", () => {
    expect(bunTargetFlag("x86_64-pc-windows-msvc")).toBe("--target=bun-windows-x64");
    expect(bunTargetFlag("aarch64-pc-windows-msvc")).toBe("--target=bun-windows-arm64");
  });

  it("keeps existing unix mappings", () => {
    expect(bunTargetFlag("x86_64-apple-darwin")).toBe("--target=bun-darwin-x64");
    expect(bunTargetFlag("aarch64-unknown-linux-gnu")).toBe("--target=bun-linux-arm64");
  });
});

describe("sidecarOutPath", () => {
  it("adds .exe for Windows triples", () => {
    expect(sidecarOutPath("x86_64-pc-windows-msvc")).toBe(
      "src-tauri/binaries/agent-worker-x86_64-pc-windows-msvc.exe",
    );
  });

  it("omits .exe on unix triples", () => {
    expect(sidecarOutPath("x86_64-unknown-linux-gnu")).toBe(
      "src-tauri/binaries/agent-worker-x86_64-unknown-linux-gnu",
    );
  });
});

describe("resolveSidecarTarget", () => {
  it("honours BUDDY_BUILD_TARGET", () => {
    expect(
      resolveSidecarTarget({ BUDDY_BUILD_TARGET: "x86_64-pc-windows-msvc" }, "linux", "x64"),
    ).toBe("x86_64-pc-windows-msvc");
  });

  it("falls back to the Windows MSVC triple on win32 when rustc is absent", () => {
    // resolveSidecarTarget still tries rustc; when present that wins. The
    // platform fallback itself is what B2 needs when rustc is missing.
    expect(platformFallbackTriple("win32", "x64")).toBe("x86_64-pc-windows-msvc");
    expect(platformFallbackTriple("win32", "arm64")).toBe("aarch64-pc-windows-msvc");
  });
});
