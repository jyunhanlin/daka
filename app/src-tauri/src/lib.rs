pub mod commands;
pub mod config;
pub mod daka;
pub mod modules;
pub mod notification;
pub mod scheduler;
pub mod tray;
pub mod update_checker;

use config::AppConfig;
use daka::DakaService;
use modules::{mayo::Mayo, femas::Femas, HrModule};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tray::TrayState;

/// Hide the app from Dock and Cmd+Tab — menu bar only.
#[cfg(target_os = "macos")]
fn set_macos_accessory_mode() {
    use cocoa::appkit::{NSApp, NSApplication, NSApplicationActivationPolicy};
    unsafe {
        let app = NSApp();
        app.setActivationPolicy_(
            NSApplicationActivationPolicy::NSApplicationActivationPolicyAccessory,
        );
    }
}

pub fn run() {
    env_logger::init();

    let config = AppConfig::load_or_create_default();
    let is_first_run = !config.is_configured();

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
        .setup(move |app| {
            // Hide from Dock — must be called after Tauri initializes NSApplication
            #[cfg(target_os = "macos")]
            set_macos_accessory_mode();

            let handle = app.handle().clone();

            // Shared tray state
            let tray_state = Arc::new(Mutex::new(TrayState::default()));
            let _tray = tray::build_tray(&handle, &tray_state.lock().unwrap())?;

            // Check for updates
            let handle_for_update = handle.clone();
            let tray_state_for_update = tray_state.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(update) = update_checker::check_for_update().await {
                    log::info!("Update available: {}", update.version);
                    if let Ok(mut state) = tray_state_for_update.lock() {
                        state.update_available = Some(update.version);
                    }
                    if let Some(tray_icon) = handle_for_update.tray_by_id("daka") {
                        if let Ok(state) = tray_state_for_update.lock() {
                            let _ = tray::rebuild_tray_menu(&handle_for_update, &tray_icon, &state);
                        }
                    }
                }
            });

            // Open settings on first run
            if is_first_run {
                let _ = tauri::WebviewWindowBuilder::new(
                    &handle,
                    "settings",
                    tauri::WebviewUrl::App("settings.html".into()),
                )
                .title("Daka 設定")
                .inner_size(480.0, 520.0)
                .resizable(false)
                .build();
            }

            // Start scheduler only if app is configured
            if config.is_configured() {
                let config_clone = config.clone();
                let handle_clone = handle.clone();
                let tray_state_clone = tray_state.clone();

                let module: Arc<dyn HrModule> = match config.general.module.as_str() {
                    "femas" => {
                        let domain = config
                            .femas
                            .as_ref()
                            .map(|f| f.domain.clone())
                            .unwrap_or_default();
                        Arc::new(Femas::new(domain))
                    }
                    _ => Arc::new(Mayo::new()),
                };

                let (username, password) = match config.general.module.as_str() {
                    "femas" => config
                        .femas
                        .as_ref()
                        .map(|f| (f.username.clone(), f.password.clone()))
                        .unwrap_or_default(),
                    _ => config
                        .mayo
                        .as_ref()
                        .map(|m| (m.username.clone(), m.password.clone()))
                        .unwrap_or_default(),
                };

                let daka_service = Arc::new(DakaService::new(
                    module,
                    username,
                    password,
                    config.general.max_retries,
                ));

                // Store as managed state so tray manual-punch handlers can access it
                app.manage(daka_service.clone());

                let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

                // Spawn scheduler
                tauri::async_runtime::spawn(async move {
                    scheduler::run_scheduler(daka_service, config_clone, tx).await;
                });

                // Spawn event listener: update tray + send notifications
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        // Update tray state
                        if let Ok(mut state) = tray_state_clone.lock() {
                            state.set_outcome(event.punch_type, &event.outcome);
                        }

                        // Rebuild tray menu to reflect new state
                        if let Some(tray_icon) = handle_clone.tray_by_id("daka") {
                            if let Ok(state) = tray_state_clone.lock() {
                                let _ = tray::rebuild_tray_menu(&handle_clone, &tray_icon, &state);
                            }
                        }

                        // Send notification
                        notification::notify_outcome(
                            &handle_clone,
                            event.punch_type,
                            &event.outcome,
                        );
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
