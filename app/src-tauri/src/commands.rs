use crate::config::AppConfig;
use tauri::command;

#[command]
pub fn get_config() -> Result<AppConfig, String> {
    AppConfig::load().map_err(|e| e.to_string())
}

#[command]
pub fn save_config(config: AppConfig) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())
}

#[command]
pub fn get_default_config() -> AppConfig {
    AppConfig::default()
}
