// src-tauri/src/main.rs — minimal Rust shell (Phase 0).
// Window management + Node.js worker lifecycle via tauri-plugin-js.
// All application logic lives in the TypeScript worker (backends/).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::image::Image;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;

struct MenuLabels {
    about: &'static str,
    edit: &'static str,
    settings: &'static str,
    #[cfg_attr(target_os = "linux", allow(dead_code))]
    window: &'static str,
}

fn menu_labels(lang: &str) -> MenuLabels {
    match lang {
        "es" => MenuLabels {
            about: "Acerca de buddy",
            edit: "Editar",
            settings: "Ajustes…",
            window: "Ventana",
        },
        _ => MenuLabels {
            about: "About buddy",
            edit: "Edit",
            settings: "Settings…",
            window: "Window",
        },
    }
}

fn detect_language() -> &'static str {
    if let Some(home) = std::env::var_os("HOME") {
        let config_path = std::path::PathBuf::from(home).join(".buddy/config.json");
        if let Ok(raw) = std::fs::read_to_string(config_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(lang) = val.get("language").and_then(|v| v.as_str()) {
                    if lang.starts_with("es") {
                        return "es";
                    }
                }
            }
        }
    }
    if let Some(locale) = sys_locale::get_locale() {
        if locale.starts_with("es") {
            return "es";
        }
    }
    "en"
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_js::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let labels = menu_labels(detect_language());

            let icon = Image::from_bytes(include_bytes!("../icons/64x64.png"))
                .expect("embedded icon");
            let about = AboutMetadata {
                icon: Some(icon),
                name: Some("buddy".to_string()),
                // From Cargo.toml — never hardcode, it silently drifts on release.
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
                comments: Some(
                    "Personal assistant with persistent memory.\nYour memory lives in a local folder you control.\nBuddy can fetch web pages when you ask, but never sends your files or conversations to external services beyond your chosen AI provider."
                        .to_string(),
                ),
                copyright: Some("© 2026 Juanje Ojeda".to_string()),
                license: Some("GPL-3.0".to_string()),
                website: Some("https://github.com/juanje/buddy".to_string()),
                website_label: Some("GitHub".to_string()),
                ..Default::default()
            };

            let settings_item = MenuItemBuilder::with_id("settings", labels.settings)
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let about_item = PredefinedMenuItem::about(app, Some(labels.about), Some(about))?;

            let app_submenu = SubmenuBuilder::new(app, "buddy")
                .item(&about_item)
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

            let edit_submenu = SubmenuBuilder::new(app, labels.edit)
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            #[cfg(not(target_os = "linux"))]
            let window_submenu = SubmenuBuilder::new(app, labels.window)
                .minimize()
                .close_window()
                .build()?;

            let menu = {
                #[cfg(not(target_os = "linux"))]
                {
                    MenuBuilder::new(app)
                        .items(&[&app_submenu, &edit_submenu, &window_submenu])
                        .build()?
                }
                #[cfg(target_os = "linux")]
                {
                    MenuBuilder::new(app)
                        .items(&[&app_submenu, &edit_submenu])
                        .build()?
                }
            };

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
