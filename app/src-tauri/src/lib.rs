pub mod config;
pub mod daka;
pub mod modules;
pub mod scheduler;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("Daka")
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
