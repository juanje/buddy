// tests/unit/wiki-file-paths.test.ts — wiki connection path normalization.

import { describe, expect, it } from "vitest";

import { normalizeConnectionPaths } from "../../backends/wiki-file";

describe("normalizeConnectionPaths", () => {
  const pageWikiRel = "agentes-de-ia-y-memoria/la-arquitectura-del-contexto.md";

  it("converts wiki-root-relative paths to page-relative links", () => {
    const normalized = normalizeConnectionPaths(
      [{ path: "sistemas-complejos/memoria-del-sistema.md", description: "related" }],
      pageWikiRel,
    );
    expect(normalized[0].path).toBe("../sistemas-complejos/memoria-del-sistema.md");
  });

  it("converts same-category wiki-root paths to bare filenames", () => {
    const normalized = normalizeConnectionPaths(
      [{ path: "agentes-de-ia-y-memoria/revelacion-progresiva.md", description: "related" }],
      pageWikiRel,
    );
    expect(normalized[0].path).toBe("revelacion-progresiva.md");
  });

  it("strips user/wiki/ prefix before normalizing", () => {
    const normalized = normalizeConnectionPaths(
      [{ path: "user/wiki/sistemas-complejos/memoria-del-sistema.md", description: "related" }],
      pageWikiRel,
    );
    expect(normalized[0].path).toBe("../sistemas-complejos/memoria-del-sistema.md");
  });

  it("leaves bare filenames and already-relative paths unchanged", () => {
    expect(
      normalizeConnectionPaths([{ path: "equilibrio.md", description: "x" }], pageWikiRel)[0].path,
    ).toBe("equilibrio.md");
    expect(
      normalizeConnectionPaths([{ path: "../herramientas/cognicion-extendida.md", description: "x" }], pageWikiRel)[0]
        .path,
    ).toBe("../herramientas/cognicion-extendida.md");
    expect(
      normalizeConnectionPaths([{ path: "./local.md", description: "x" }], pageWikiRel)[0].path,
    ).toBe("./local.md");
  });

  it("preserves URL fragments on normalized paths", () => {
    const normalized = normalizeConnectionPaths(
      [{ path: "sistemas-complejos/memoria-del-sistema.md#section", description: "related" }],
      pageWikiRel,
    );
    expect(normalized[0].path).toBe("../sistemas-complejos/memoria-del-sistema.md#section");
  });
});
