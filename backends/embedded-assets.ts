// backends/embedded-assets.ts — Registry of assets embedded in the compiled
// sidecar binary (E12). Repo-relative resource paths (templates/, bundled/)
// don't exist inside a bun-compiled binary, so sidecar-entry.ts registers the
// build-time snapshot here before the worker boots. In dev nothing registers
// and callers fall back to reading the repo tree from disk.

export interface EmbeddedAssets {
  /** Template files, path relative to templates/ (e.g. "agent_brain/identity/SOUL.md") → content. */
  templates: Record<string, string>;
  /** Prompt filenames relative to bundled/prompts/ (e.g. "agents-base.md") → content. */
  prompts: Record<string, string>;
}

let assets: EmbeddedAssets | undefined;

/** Called once by sidecar-entry.ts; pass undefined to reset (tests). */
export function registerEmbeddedAssets(next: EmbeddedAssets | undefined): void {
  assets = next;
}

export function getEmbeddedAssets(): EmbeddedAssets | undefined {
  return assets;
}
