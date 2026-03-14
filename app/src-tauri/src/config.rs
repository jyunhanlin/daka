use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Config file not found: {0}")]
    NotFound(PathBuf),
    #[error("Failed to read config file {0}: {1}")]
    ReadError(PathBuf, std::io::Error),
    #[error("Failed to parse config file {0}: {1}")]
    ParseError(PathBuf, toml::de::Error),
    #[error("Failed to write config file {0}: {1}")]
    WriteError(PathBuf, std::io::Error),
    #[error("Failed to serialize config: {0}")]
    SerializeError(toml::ser::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    pub general: GeneralConfig,
    pub schedule: ScheduleConfig,
    pub mayo: Option<MayoConfig>,
    pub femas: Option<FemasConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GeneralConfig {
    pub module: String,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScheduleConfig {
    pub punch_in: String,
    pub punch_out: String,
    pub delay_start_mins: u32,
    pub delay_end_mins: u32,
    pub late_tolerance_mins: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MayoConfig {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FemasConfig {
    pub domain: String,
    pub username: String,
    pub password: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            general: GeneralConfig {
                module: "mayo".to_string(),
                max_retries: 3,
            },
            schedule: ScheduleConfig {
                punch_in: "10:00".to_string(),
                punch_out: "19:00".to_string(),
                delay_start_mins: 5,
                delay_end_mins: 15,
                late_tolerance_mins: 30,
            },
            mayo: Some(MayoConfig {
                username: String::new(),
                password: String::new(),
            }),
            femas: None,
        }
    }
}

impl AppConfig {
    pub fn is_configured(&self) -> bool {
        match self.general.module.as_str() {
            "mayo" => self
                .mayo
                .as_ref()
                .map(|m| !m.username.is_empty() && !m.password.is_empty())
                .unwrap_or(false),
            "femas" => self
                .femas
                .as_ref()
                .map(|f| !f.domain.is_empty() && !f.username.is_empty() && !f.password.is_empty())
                .unwrap_or(false),
            _ => false,
        }
    }

    pub fn config_dir() -> PathBuf {
        dirs::config_dir()
            .expect("Could not determine config directory")
            .join("daka")
    }

    pub fn config_path() -> PathBuf {
        Self::config_dir().join("config.toml")
    }

    pub fn load() -> Result<Self, ConfigError> {
        let path = Self::config_path();

        if !path.exists() {
            return Err(ConfigError::NotFound(path));
        }

        let contents =
            std::fs::read_to_string(&path).map_err(|e| ConfigError::ReadError(path.clone(), e))?;

        toml::from_str(&contents).map_err(|e| ConfigError::ParseError(path, e))
    }

    pub fn save(&self) -> Result<(), ConfigError> {
        let path = Self::config_path();
        let dir = Self::config_dir();

        std::fs::create_dir_all(&dir)
            .map_err(|e| ConfigError::WriteError(dir.clone(), e))?;

        let contents = toml::to_string_pretty(self).map_err(ConfigError::SerializeError)?;

        std::fs::write(&path, contents).map_err(|e| ConfigError::WriteError(path, e))
    }

    pub fn load_or_create_default() -> Self {
        match Self::load() {
            Ok(config) => config,
            Err(_) => {
                let default = Self::default();
                let _ = default.save();
                default
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_config() {
        let toml_str = r#"
[general]
module = "mayo"
max_retries = 3

[schedule]
punch_in = "09:00"
punch_out = "19:00"
delay_start_mins = 5
delay_end_mins = 15
late_tolerance_mins = 30

[mayo]
username = "testuser"
password = "testpass"
"#;

        let config: AppConfig = toml::from_str(toml_str).expect("Failed to parse config");

        assert_eq!(config.general.module, "mayo");
        assert_eq!(config.general.max_retries, 3);
        assert_eq!(config.schedule.punch_in, "09:00");
        assert_eq!(config.schedule.punch_out, "19:00");
        assert_eq!(config.schedule.delay_start_mins, 5);
        assert_eq!(config.schedule.delay_end_mins, 15);
        assert_eq!(config.schedule.late_tolerance_mins, 30);

        let mayo = config.mayo.expect("Expected mayo config");
        assert_eq!(mayo.username, "testuser");
        assert_eq!(mayo.password, "testpass");

        assert!(config.femas.is_none());
    }

    #[test]
    fn test_default_config_generates_valid_toml() {
        let config = AppConfig::default();
        let toml_str = toml::to_string_pretty(&config).expect("Failed to serialize default config");
        let parsed: AppConfig = toml::from_str(&toml_str).expect("Failed to parse serialized config");
        assert_eq!(config, parsed);
    }

    #[test]
    fn test_config_round_trip_with_femas() {
        let config = AppConfig {
            general: GeneralConfig {
                module: "femas".to_string(),
                max_retries: 5,
            },
            schedule: ScheduleConfig {
                punch_in: "08:30".to_string(),
                punch_out: "18:00".to_string(),
                delay_start_mins: 10,
                delay_end_mins: 20,
                late_tolerance_mins: 15,
            },
            mayo: None,
            femas: Some(FemasConfig {
                domain: "example.com".to_string(),
                username: "femasuser".to_string(),
                password: "femaspass".to_string(),
            }),
        };

        let toml_str = toml::to_string_pretty(&config).expect("Failed to serialize femas config");
        let parsed: AppConfig = toml::from_str(&toml_str).expect("Failed to parse femas config");
        assert_eq!(config, parsed);
    }

    #[test]
    fn test_is_configured_returns_false_for_empty_credentials() {
        let config = AppConfig::default();
        assert!(!config.is_configured());
    }

    #[test]
    fn test_is_configured_returns_true_for_mayo_with_credentials() {
        let config = AppConfig {
            mayo: Some(MayoConfig {
                username: "user".to_string(),
                password: "pass".to_string(),
            }),
            ..AppConfig::default()
        };
        assert!(config.is_configured());
    }
}
