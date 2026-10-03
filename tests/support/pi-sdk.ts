// tests/support/pi-sdk.ts — facts about the installed Pi SDK, shared by the
// FR-SDK-04 unit tests and BDD steps.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PI_PKG = join(ROOT, "node_modules/@earendil-works/pi-coding-agent");

export function installedPiVersion(): string {
  return JSON.parse(readFileSync(join(PI_PKG, "package.json"), "utf8")).version;
}

export function declaredPiRange(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return pkg.dependencies["@earendil-works/pi-coding-agent"];
}

export function majorOf(versionOrRange: string): number {
  return Number(versionOrRange.replace(/^[^\d]*/, "").split(".")[0]);
}

/**
 * Every Pi-internal file Buddy reaches by a literal `node_modules/@earendil-works/...`
 * path. Discovered by scanning backends/, so a deep import added later is
 * checked without anyone remembering to register it. The one computed path
 * (pi-http-dispatcher.ts builds it from import.meta.resolve) is listed
 * explicitly.
 */
export function deepImportPaths(): { file: string; path: string }[] {
  const found: { file: string; path: string }[] = [];
  const dir = join(ROOT, "backends");
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(join(dir, name), "utf8");
    for (const m of src.matchAll(/["'`]((?:\.\.\/)+node_modules\/@earendil-works\/[^"'`]+\.js)["'`]/g)) {
      found.push({ file: `backends/${name}`, path: join(dir, m[1]) });
    }
  }
  found.push({
    file: "backends/pi-http-dispatcher.ts (computed)",
    path: join(PI_PKG, "dist/core/http-dispatcher.js"),
  });
  return found;
}

export function missingDeepImports(): string[] {
  return deepImportPaths()
    .filter(({ path }) => !existsSync(path))
    .map(({ file, path }) => `${file} → ${path}`);
}

const PI_AI_ALL =
  "../../node_modules/@earendil-works/pi-ai/dist/providers/all.js";

/** Provider ids in Pi's built-in catalog. */
export async function piCatalogProviders(): Promise<string[]> {
  const mod = await import(/* @vite-ignore */ PI_AI_ALL);
  return [...mod.getBuiltinProviders()];
}
