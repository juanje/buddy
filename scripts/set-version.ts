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

/**
 * Apply `transform`, which returns null when its pattern found nothing.
 *
 * The distinction matters and the first version of this script got it wrong: an
 * unmatched pattern is a broken script and must fail loudly, while a file
 * already holding the right version is simply nothing to do. Conflating them
 * made re-running the script an error, which is the opposite of what a
 * resync command is for.
 */
function edit(relPath: string, transform: (source: string) => string | null): void {
  const path = join(ROOT, relPath);
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === null) {
    throw new Error(`${relPath}: nothing matched — the file's shape changed, fix this script`);
  }
  if (after === before) {
    console.log(`  ${relPath} (already ${version})`);
    return;
  }
  writeFileSync(path, after);
  console.log(`  ${relPath}`);
}

/** Replace a JSON top-level "version" without reserializing the whole file. */
function setJsonVersion(source: string): string | null {
  const pattern = /^(\s*"version"\s*:\s*)"[^"]*"/m;
  if (!pattern.test(source)) return null;
  return source.replace(pattern, `$1"${version}"`);
}

console.log(`Setting version ${version}:`);

edit("package.json", setJsonVersion);
edit("src-tauri/tauri.conf.json", setJsonVersion);

edit("src-tauri/Cargo.toml", (source) => {
  // Only the [package] version. Dependencies carry `version` keys of their own
  // (`tauri = { version = "2" }`), and rewriting those would be a disaster that
  // compiles.
  const sectionStart = source.indexOf("[package]");
  if (sectionStart === -1) return null;
  const nextSection = source.indexOf("\n[", sectionStart + 1);
  const end = nextSection === -1 ? source.length : nextSection;
  const pkgSection = source.slice(sectionStart, end);
  if (!/^version\s*=\s*"[^"]*"/m.test(pkgSection)) return null;
  const patched = pkgSection.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
  return source.slice(0, sectionStart) + patched + source.slice(end);
});

edit("src-tauri/Cargo.lock", (source) => {
  // The lock records the crate's own version too, and it is committed. Cargo
  // would rewrite it on the next build, but "the next build" is not when the
  // release tag is cut — v0.1.8 was tagged with a lock still naming 0.1.7.
  // Patched directly so this script needs no Rust toolchain.
  const block = /(\nname = "buddy"\nversion = )"[^"]*"/g;
  const matches = [...source.matchAll(block)];
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(`Cargo.lock: expected one "buddy" package block, found ${matches.length}`);
  }
  return source.replace(block, `$1"${version}"`);
});

// Regenerates from package.json, which now holds the new version. Importing it
// runs it — the generator is a top-level script, and going through it rather
// than patching the line keeps one owner for that file's format.
console.log("  backends/embedded-assets.generated.ts (regenerating)");
await import("./generate-embedded-assets.ts");

console.log("\nDone. Run the quality gate, then commit.");
