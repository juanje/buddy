// tests/unit/shell-menu.test.ts — FR-SHELL-07/08/09 structural checks for the Rust shell menu.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const CARGO = join(ROOT, "src-tauri", "Cargo.toml");
const MAIN = join(ROOT, "src-tauri", "src", "main.rs");

function readMain(): string {
  return readFileSync(MAIN, "utf8");
}

function readCargo(): string {
  return readFileSync(CARGO, "utf8");
}

describe("FR-SHELL-07 — About dialog icon", () => {
  it("enables the Tauri image-png feature in Cargo.toml", () => {
    expect(readCargo()).toMatch(/tauri\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"image-png"/s);
  });

  it("embeds the About icon via include_bytes in main.rs", () => {
    const source = readMain();
    expect(source).toContain('include_bytes!("../icons/64x64.png")');
    expect(source).toMatch(/AboutMetadata\s*\{[\s\S]*icon:\s*Some\(/);
  });
});

describe("FR-SHELL-08 — Hide empty Window menu on Linux", () => {
  it("cfg-gates the Window submenu for non-Linux platforms", () => {
    const source = readMain();
    expect(source).toMatch(
      /#\[cfg\(not\(target_os\s*=\s*"linux"\)\)\][\s\S]*let window_submenu/,
    );
    expect(source).toMatch(/#\[cfg\(target_os\s*=\s*"linux"\)\][\s\S]*\.items\(\&\[\&app_submenu, \&edit_submenu\]\)/);
  });
});

describe("FR-SHELL-09 — Native menu label i18n", () => {
  it("defines a translation table covering es and en", () => {
    const source = readMain();
    expect(source).toMatch(/fn\s+menu_labels\s*\(/);
    expect(source).toContain('"Editar"');
    expect(source).toContain('"Ajustes…"');
    expect(source).toContain('"Ventana"');
    expect(source).toContain('"About buddy"');
    expect(source).toContain('"Acerca de buddy"');
    expect(source).toContain('"Edit"');
    expect(source).toContain('"Settings…"');
    expect(source).toContain('"Window"');
  });

  it("detects language from config and system locale", () => {
    const source = readMain();
    expect(source).toMatch(/fn\s+detect_language\s*\(/);
    expect(source).toContain(".buddy/config.json");
    expect(source).toContain("sys_locale::get_locale");
  });

  it("does not hardcode English menu labels outside the translation table", () => {
    const source = readMain();
    const withoutTable = source.replace(/fn menu_labels[\s\S]*?^}/m, "");
    expect(withoutTable).not.toMatch(/SubmenuBuilder::new\([^,]+,\s*"Edit"\)/);
    expect(withoutTable).not.toMatch(/MenuItemBuilder::with_id\([^,]+,\s*"Settings\.\.\."\)/);
    expect(withoutTable).not.toMatch(/SubmenuBuilder::new\([^,]+,\s*"Window"\)/);
  });
});
