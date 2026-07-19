// src-tauri/src/main.rs — minimal Rust shell (Phase 0).
// Window management + Node.js worker lifecycle via tauri-plugin-js.
// All application logic lives in the TypeScript worker (backends/).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_js::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running ab-app");
}
