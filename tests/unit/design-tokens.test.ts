// tests/unit/design-tokens.test.ts — CSS custom properties are real (NFR-ACC-04).
//
// `var(--name, #hex)` is not a safety net, it is a way for a typo to render.
// A component referencing a token nobody defines keeps working — with the
// literal fallback, in both colour schemes — so NFR-ACC-01 ("follow
// prefers-color-scheme") fails without anything looking broken in review.
// Found in the FR-CHAT-13 banner, which asked for `--surface-2` and `--text`
// and had drawn itself dark-on-dark in light mode since the day it shipped.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(__dirname, "..", "..", "src");

function styleSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...styleSources(path));
    } else if ([".css", ".svelte"].includes(extname(entry))) {
      out.push(path);
    }
  }
  return out;
}

interface Reference {
  name: string;
  hasFallback: boolean;
  file: string;
}

/** `--name:` in a declaration. `var(--name, …)` has no colon, so it cannot match here. */
const DEFINITION = /--([a-zA-Z0-9-]+)\s*:/g;
const REFERENCE = /var\(\s*--([a-zA-Z0-9-]+)\s*([,)])/g;

const files = styleSources(SRC_DIR);
const defined = new Set<string>();
const referenced: Reference[] = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const relative = file.slice(SRC_DIR.length + 1);
  for (const match of source.matchAll(DEFINITION)) defined.add(match[1]);
  for (const match of source.matchAll(REFERENCE)) {
    referenced.push({ name: match[1], hasFallback: match[2] === ",", file: relative });
  }
}

describe("CSS design tokens (NFR-ACC-04)", () => {
  it("scans the stylesheets it claims to scan", () => {
    // Guards the two assertions below from passing vacuously: a broken walk, a
    // regex that stops matching, or a move of app.css would otherwise turn this
    // file green while checking nothing.
    expect(files.some((f) => f.endsWith("app.css"))).toBe(true);
    expect(files.filter((f) => f.endsWith(".svelte")).length).toBeGreaterThan(5);
    expect(defined.has("bg")).toBe(true);
    expect(referenced.length).toBeGreaterThan(20);
  });

  it("defines every custom property that a component references", () => {
    const undefinedRefs = referenced
      .filter((ref) => !defined.has(ref.name))
      .map((ref) => `${ref.file}: var(--${ref.name})`);

    expect(undefinedRefs).toEqual([]);
  });

  it("carries no fallback on a property that is defined", () => {
    const deadFallbacks = referenced
      .filter((ref) => ref.hasFallback && defined.has(ref.name))
      .map((ref) => `${ref.file}: var(--${ref.name}, …) — --${ref.name} is always defined`);

    expect(deadFallbacks).toEqual([]);
  });
});
