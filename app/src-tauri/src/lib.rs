pub mod commands;
pub mod config;
pub mod daka;
pub mod modules;
pub mod notification;
pub mod scheduler;
pub mod tray;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("Daka")
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::get_default_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
