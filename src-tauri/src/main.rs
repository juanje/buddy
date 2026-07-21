// src-tauri/src/main.rs — minimal Rust shell (Phase 0).
// Window management + Node.js worker lifecycle via tauri-plugin-js.
// All application logic lives in the TypeScript worker (backends/).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_js::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let about = AboutMetadata {
                name: Some("Buddy".to_string()),
                version: Some("0.1.0".to_string()),
                comments: Some(
                    "Personal assistant with persistent memory.\nEverything lives in a local folder — nothing leaves your computer."
                        .to_string(),
                ),
                copyright: Some("© 2026 Juanje Ojeda".to_string()),
                license: Some("GPL-3.0".to_string()),
                website: Some("https://github.com/juanje/ab-app".to_string()),
                website_label: Some("GitHub".to_string()),
                ..Default::default()
            };

            let settings_item = MenuItemBuilder::with_id("settings", "Settings...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "Buddy")
                .about(Some(about))
                .item(&settings_item)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_submenu, &edit_submenu, &window_submenu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id() == settings_item.id() {
                    let _ = app.emit("menu-settings", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running buddy");
}
