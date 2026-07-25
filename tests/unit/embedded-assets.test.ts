// tests/unit/embedded-assets.test.ts — E12: assets embedded in the compiled
// sidecar must be used instead of repo-relative disk paths, which don't exist
// inside the bun binary.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { registerEmbeddedAssets } from "../../backends/embedded-assets";
import { copyTemplates } from "../../backends/create-buddy";
import { ensureSchema } from "../../backends/schema-migration";

describe("embedded assets (compiled sidecar)", () => {
  let dir: string;

  afterEach(() => {
    registerEmbeddedAssets(undefined);
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("migrate 0→1 writes prompts from embedded assets, not disk", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-embedded-"));
    registerEmbeddedAssets({
      templates: {},
      prompts: { "agents-base.md": "# embedded base\n", "consolidation.md": "# embedded consol\n" },
    });

    ensureSchema(dir);

    expect(readFileSync(join(dir, "prompts", "agents-base.md"), "utf8")).toBe("# embedded base\n");
    expect(readFileSync(join(dir, "prompts", "consolidation.md"), "utf8")).toBe("# embedded consol\n");
    // Only embedded prompts, not the repo's bundled/prompts content.
    expect(existsSync(join(dir, "prompts", "process-conversation.md"))).toBe(false);
  });

  it("copyTemplates materializes the embedded tree including dotfiles", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-embedded-"));
    registerEmbeddedAssets({
      templates: {
        "AGENTS.md": "# agents\n",
        ".gitignore": ".buddy/\n",
        "agent_brain/identity/SOUL.md": "# soul\n",
        "logs/archive/.gitkeep": "",
      },
      prompts: {},
    });

    const target = join(dir, "ab");
    copyTemplates(target);

    expect(readFileSync(join(target, "AGENTS.md"), "utf8")).toBe("# agents\n");
    expect(readFileSync(join(target, ".gitignore"), "utf8")).toBe(".buddy/\n");
    expect(readFileSync(join(target, "agent_brain", "identity", "SOUL.md"), "utf8")).toBe("# soul\n");
    expect(existsSync(join(target, "logs", "archive", ".gitkeep"))).toBe(true);
  });

  it("an explicit templatesDir wins over embedded assets", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-embedded-"));
    registerEmbeddedAssets({ templates: { "AGENTS.md": "# embedded\n" }, prompts: {} });

    const source = join(dir, "source");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "AGENTS.md"), "# from disk\n");

    const target = join(dir, "ab");
    copyTemplates(target, source);

    expect(readFileSync(join(target, "AGENTS.md"), "utf8")).toBe("# from disk\n");
  });

  it("without registration, copyTemplates falls back to the repo templates dir", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-embedded-"));

    const target = join(dir, "ab");
    copyTemplates(target);

    expect(existsSync(join(target, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(target, "agent_brain", "identity", "SOUL.md"))).toBe(true);
  });
});
