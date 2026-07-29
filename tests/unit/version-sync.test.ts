// tests/unit/version-sync.test.ts — the app version has one source (NFR-MIGRATE-07).
//
// Four files carry it and each is read by a different consumer: Cargo's is what
// the About dialog shows, Tauri's names the published release, the snapshot's is
// what the compiled sidecar reports, and package.json is the source the other
// three derive from. The v0.1.8 bump updated three of them; the miss survived a
// whole release because the file it missed is regenerated at build time, so it
// was wrong only in the repository. Nothing was going to notice that but this.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function packageVersion(): string {
  return (JSON.parse(read("package.json")) as { version: string }).version;
}

function tauriConfVersion(): string {
  return (JSON.parse(read("src-tauri", "tauri.conf.json")) as { version: string }).version;
}

/** The `[package]` version only — dependencies carry their own `version` keys. */
function cargoVersion(): string {
  const pkgSection = read("src-tauri", "Cargo.toml").split(/^\[/m)[1];
  const match = /^version\s*=\s*"([^"]+)"/m.exec(pkgSection);
  if (!match) throw new Error("no [package] version in Cargo.toml");
  return match[1];
}

function embeddedVersion(): string {
  const match = /EMBEDDED_APP_VERSION = "([^"]+)"/.exec(
    read("backends", "embedded-assets.generated.ts"),
  );
  if (!match) throw new Error("no EMBEDDED_APP_VERSION in the generated snapshot");
  return match[1];
}

describe("app version (NFR-MIGRATE-07)", () => {
  it("is a semver in package.json", () => {
    expect(packageVersion()).toMatch(SEMVER);
  });

  it.each([
    ["src-tauri/tauri.conf.json — names the published release", tauriConfVersion],
    ["src-tauri/Cargo.toml — shown in the About dialog", cargoVersion],
    ["backends/embedded-assets.generated.ts — reported by the sidecar", embeddedVersion],
  ])("matches package.json in %s", (_where, actual) => {
    expect(actual()).toBe(packageVersion());
  });

  it("reads a real version from each file rather than silently matching nothing", () => {
    // Each reader throws on a missing match, but a regex that started matching
    // the wrong thing could return a value that happens to agree. Cheap guard.
    for (const value of [tauriConfVersion(), cargoVersion(), embeddedVersion()]) {
      expect(value).toMatch(SEMVER);
    }
  });
});
