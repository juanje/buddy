// tests/steps/shell-menu.steps.ts — FR-SHELL-07/08/09 structural BDD steps.

import { Given, Then } from "@cucumber/cucumber";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const CARGO = join(ROOT, "src-tauri", "Cargo.toml");
const MAIN = join(ROOT, "src-tauri", "src", "main.rs");

function readMain(): string {
  return readFileSync(MAIN, "utf8");
}

function readCargo(): string {
  return readFileSync(CARGO, "utf8");
}

Given("the Rust shell Cargo.toml is present", () => {
  assert.match(readCargo(), /\[dependencies\]/);
});

Given("the Rust shell main.rs is present", () => {
  assert.match(readMain(), /fn main\(\)/);
});

Then("the Tauri image-png feature is enabled", () => {
  assert.match(readCargo(), /tauri\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"image-png"/s);
});

Then("main.rs embeds the About dialog icon via include_bytes", () => {
  const source = readMain();
  assert.ok(source.includes('include_bytes!("../icons/64x64.png")'));
  assert.match(source, /AboutMetadata\s*\{[\s\S]*icon:\s*Some\(/);
});

Then("the Window submenu is cfg-gated for non-Linux platforms", () => {
  const source = readMain();
  assert.match(
    source,
    /#\[cfg\(not\(target_os\s*=\s*"linux"\)\)\][\s\S]*let window_submenu/,
  );
  assert.match(
    source,
    /#\[cfg\(target_os\s*=\s*"linux"\)\][\s\S]*\.items\(\&\[\&app_submenu, \&edit_submenu\]\)/,
  );
});

Then("main.rs defines a menu label translation table for es and en", () => {
  const source = readMain();
  assert.match(source, /fn\s+menu_labels\s*\(/);
  for (const label of ["Acerca de buddy", "About buddy", "Editar", "Ajustes…", "Ventana", "Edit", "Settings…", "Window"]) {
    assert.ok(source.includes(`"${label}"`), `missing label ${label}`);
  }
});

Then("main.rs detects language from config and system locale", () => {
  const source = readMain();
  assert.match(source, /fn\s+detect_language\s*\(/);
  assert.ok(source.includes(".buddy/config.json"));
  assert.ok(source.includes("sys_locale::get_locale"));
});
