// scripts/set-version.ts — set the app version everywhere at once (NFR-MIGRATE-07).
//
//   npm run version:set 0.1.9
//
// package.json is the source; tauri.conf.json, Cargo.toml and the embedded
// snapshot restate it for three different consumers. Bumping by hand is four
// edits with no failure mode for forgetting one — v0.1.8 shipped having missed
// the snapshot. tests/unit/version-sync.test.ts fails when they disagree; this
// is how you make them agree.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const version = process.argv[2];
if (!version || !SEMVER.test(version)) {
  console.error(`Usage: npm run version:set <semver>\nGot: ${version ?? "(nothing)"}`);
  process.exit(1);
}

function edit(relPath: string, transform: (source: string) => string): void {
  const path = join(ROOT, relPath);
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) {
    // Never report success for a file this script did not actually change: a
    // silently unmatched regex is exactly how one of these drifted in the
    // first place. Already-correct is fine; not-matched is not.
    throw new Error(`${relPath}: nothing matched — the file's shape changed, fix this script`);
  }
  writeFileSync(path, after);
  console.log(`  ${relPath}`);
}

/** Replace a JSON top-level "version" without reserializing the whole file. */
function setJsonVersion(source: string): string {
  return source.replace(/^(\s*"version"\s*:\s*)"[^"]*"/m, `$1"${version}"`);
}

console.log(`Setting version ${version}:`);

const pkgBefore = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  version: string;
}).version;

if (pkgBefore === version) {
  console.log(`  package.json already at ${version}; resyncing the rest`);
} else {
  edit("package.json", setJsonVersion);
}

edit("src-tauri/tauri.conf.json", setJsonVersion);

edit("src-tauri/Cargo.toml", (source) => {
  // Only the [package] version. Dependencies carry `version` keys of their own
  // (`tauri = { version = "2" }`), and rewriting those would be a disaster that
  // compiles.
  const sectionStart = source.indexOf("[package]");
  if (sectionStart === -1) throw new Error("Cargo.toml: no [package] section");
  const nextSection = source.indexOf("\n[", sectionStart + 1);
  const end = nextSection === -1 ? source.length : nextSection;
  const pkgSection = source.slice(sectionStart, end);
  const patched = pkgSection.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
  return source.slice(0, sectionStart) + patched + source.slice(end);
});

// Regenerates from package.json, which now holds the new version. Importing it
// runs it — the generator is a top-level script, and going through it rather
// than patching the line keeps one owner for that file's format.
console.log("  backends/embedded-assets.generated.ts (regenerating)");
await import("./generate-embedded-assets.ts");

console.log("\nDone. Run the quality gate, then commit.");
