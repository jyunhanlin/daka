# Daka Desktop App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS menu bar desktop app (Tauri v2 + Rust) that replaces GitHub Actions cron with a local scheduler for automated HR system punch-in/punch-out.

**Architecture:** Tauri v2 app with Rust backend handling scheduling, HR API calls, and notifications. Plain HTML/CSS/JS frontend for the settings window. Config stored as TOML at `~/.config/daka/config.toml`.

**Tech Stack:** Rust, Tauri v2, reqwest, scraper, chrono, serde, toml, tokio

**Spec:** `docs/superpowers/specs/2026-03-14-daka-desktop-app-design.md`

---

## Chunk 1: Foundation

### Task 1: Move existing CLI code to `cli/` subdirectory

**Files:**
- Move: all root-level source files → `cli/`
- Modify: `.github/workflows/daka.yaml` (update paths)

- [ ] **Step 1: Create `cli/` directory and move files**

```bash
mkdir cli
git mv src cli/src
git mv package.json cli/package.json
git mv package-lock.json cli/package-lock.json
git mv jest.config.js cli/jest.config.js
git mv Dockerfile cli/Dockerfile
git mv example.env cli/example.env
git mv .prettierrc cli/.prettierrc 2>/dev/null || true
```

- [ ] **Step 2: Update GitHub Actions workflow paths**

In `.github/workflows/daka.yaml`, update the working directory for all steps:

```yaml
jobs:
  daka:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./cli
    # ... rest stays the same but update checkout path
```

Also update `.github/workflows/docker-image.yaml` if it exists — add `working-directory: ./cli` under `defaults.run` and update the Docker build context to `./cli`:

```yaml
defaults:
  run:
    working-directory: ./cli
# ... and in the docker build step:
    - name: Build Docker image
      run: docker build -t daka .
      working-directory: ./cli
```

- [ ] **Step 3: Verify CLI still works**

```bash
cd cli && npm install && npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move existing CLI code to cli/ subdirectory"
```

---

### Task 2: Scaffold Tauri v2 app

**Files:**
- Create: `app/src-tauri/Cargo.toml`
- Create: `app/src-tauri/src/main.rs`
- Create: `app/src-tauri/src/lib.rs`
- Create: `app/src-tauri/tauri.conf.json`
- Create: `app/src-tauri/build.rs`
- Create: `app/src/index.html`
- Create: `app/package.json`

**Prerequisites:** Rust toolchain and Tauri CLI must be installed. If not:
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Install Tauri CLI
cargo install tauri-cli --version "^2.0.0"
```

- [ ] **Step 1: Initialize Tauri project**

```bash
cd /Users/jhlin/swag/daka
mkdir -p app
cd app
npm init -y
npm install -D @tauri-apps/cli@latest
```

- [ ] **Step 2: Create `app/src-tauri/Cargo.toml`**

```toml
[package]
name = "daka"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-notification = "2"
tauri-plugin-autostart = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"
reqwest = { version = "0.12", features = ["cookies", "json"] }
scraper = "0.22"
chrono = { version = "0.4", features = ["serde"] }
tokio = { version = "1", features = ["full"] }
rand = "0.8"
log = "0.4"
env_logger = "0.11"
async-trait = "0.1"
thiserror = "2"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

- [ ] **Step 3: Create `app/src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 4: Create `app/src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "Daka",
  "version": "0.1.0",
  "identifier": "com.daka.app",
  "build": {
    "frontendDist": "../src",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": []
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/icon.png"
    ]
  }
}
```

Note: `"windows": []` means no main window on startup — this is a tray-only app.

- [ ] **Step 5: Create minimal `app/src-tauri/src/lib.rs`**

```rust
mod config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
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
```

- [ ] **Step 6: Create `app/src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    daka::run();
}
```

- [ ] **Step 7: Create minimal frontend `app/src/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>Daka</title>
</head>
<body>
  <h1>Daka Settings</h1>
  <p>Settings window placeholder</p>
</body>
</html>
```

- [ ] **Step 8: Verify it compiles**

```bash
cd app/src-tauri && cargo check
```

Expected: compiles with no errors.

- [ ] **Step 9: Commit**

```bash
git add app/
git commit -m "feat: scaffold Tauri v2 app skeleton"
```

---

### Task 3: Config module

**Files:**
- Create: `app/src-tauri/src/config.rs`
- Test: inline `#[cfg(test)]` module

- [ ] **Step 1: Write failing tests for config parsing**

Create `app/src-tauri/src/config.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
username = "user@example.com"
password = "secret"
"#;
        let config: AppConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.general.module, "mayo");
        assert_eq!(config.schedule.punch_in, "09:00");
        assert_eq!(config.mayo.unwrap().username, "user@example.com");
        assert!(config.femas.is_none());
    }

    #[test]
    fn test_default_config_generates_valid_toml() {
        let config = AppConfig::default();
        let toml_str = toml::to_string_pretty(&config).unwrap();
        let parsed: AppConfig = toml::from_str(&toml_str).unwrap();
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
                punch_out: "17:30".to_string(),
                delay_start_mins: 3,
                delay_end_mins: 10,
                late_tolerance_mins: 20,
            },
            mayo: None,
            femas: Some(FemasConfig {
                domain: "mycompany".to_string(),
                username: "user".to_string(),
                password: "pass".to_string(),
            }),
        };
        let toml_str = toml::to_string_pretty(&config).unwrap();
        let parsed: AppConfig = toml::from_str(&toml_str).unwrap();
        assert_eq!(config, parsed);
    }

    #[test]
    fn test_is_configured_returns_false_for_empty_credentials() {
        let config = AppConfig::default();
        assert!(!config.is_configured());
    }

    #[test]
    fn test_is_configured_returns_true_for_mayo_with_credentials() {
        let mut config = AppConfig::default();
        config.mayo = Some(MayoConfig {
            username: "user".to_string(),
            password: "pass".to_string(),
        });
        assert!(config.is_configured());
    }
}
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd app/src-tauri && cargo test --lib config
```

Expected: FAIL — `Default` not implemented, `is_configured` not defined.

- [ ] **Step 3: Implement Default and is_configured**

Add to `config.rs`:

```rust
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            general: GeneralConfig {
                module: "mayo".to_string(),
                max_retries: 3,
            },
            schedule: ScheduleConfig {
                punch_in: "09:00".to_string(),
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
                .map_or(false, |m| !m.username.is_empty() && !m.password.is_empty()),
            "femas" => self
                .femas
                .as_ref()
                .map_or(false, |f| !f.username.is_empty() && !f.password.is_empty() && !f.domain.is_empty()),
            _ => false,
        }
    }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd app/src-tauri && cargo test --lib config
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Add file I/O functions with tests**

Add to `config.rs`:

```rust
use std::fs;

impl AppConfig {
    pub fn config_dir() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("~/.config"))
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
        let content = fs::read_to_string(&path)
            .map_err(|e| ConfigError::ReadError(path.clone(), e))?;
        toml::from_str(&content)
            .map_err(|e| ConfigError::ParseError(path, e))
    }

    pub fn save(&self) -> Result<(), ConfigError> {
        let path = Self::config_path();
        let dir = Self::config_dir();
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|e| ConfigError::WriteError(dir, e))?;
        }
        let content = toml::to_string_pretty(self)
            .map_err(|e| ConfigError::SerializeError(e))?;
        fs::write(&path, content)
            .map_err(|e| ConfigError::WriteError(path, e))
    }

    pub fn load_or_create_default() -> Self {
        match Self::load() {
            Ok(config) => config,
            Err(_) => {
                let config = Self::default();
                let _ = config.save();
                config
            }
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("config file not found: {0}")]
    NotFound(PathBuf),
    #[error("failed to read {0}: {1}")]
    ReadError(PathBuf, std::io::Error),
    #[error("failed to parse {0}: {1}")]
    ParseError(PathBuf, toml::de::Error),
    #[error("failed to write {0}: {1}")]
    WriteError(PathBuf, std::io::Error),
    #[error("failed to serialize config: {0}")]
    SerializeError(toml::ser::Error),
}
```

Add `dirs = "6"` to `Cargo.toml` dependencies.

- [ ] **Step 6: Run all tests — verify they pass**

```bash
cd app/src-tauri && cargo test --lib config
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src-tauri/src/config.rs app/src-tauri/Cargo.toml
git commit -m "feat(app): add config module with TOML parsing, defaults, and file I/O"
```

---

## Chunk 2: Core Logic

### Task 4: HrModule trait and shared types

**Files:**
- Create: `app/src-tauri/src/modules/mod.rs`
- Modify: `app/src-tauri/src/lib.rs` (add `mod modules`)

- [ ] **Step 1: Create the module trait and types**

Create `app/src-tauri/src/modules/mod.rs`:

```rust
pub mod mayo;
pub mod femas;

use async_trait::async_trait;
use chrono::NaiveDate;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PunchType {
    In,  // S — 上班
    Out, // E — 下班
}

impl PunchType {
    pub fn label(&self) -> &'static str {
        match self {
            PunchType::In => "上班",
            PunchType::Out => "下班",
        }
    }
}

#[derive(Debug, Clone)]
pub struct PunchResult {
    pub punch_type: PunchType,
    pub time: String,
}

#[derive(Debug, Error)]
pub enum HrError {
    #[error("login failed: {0}")]
    LoginFailed(String),
    #[error("failed to fetch calendar: {0}")]
    CalendarFailed(String),
    #[error("punch failed: {0}")]
    PunchFailed(String),
    #[error("network error: {0}")]
    NetworkError(#[from] reqwest::Error),
    #[error("parse error: {0}")]
    ParseError(String),
}

pub struct Session {
    pub client: reqwest::Client,
    /// Module-specific session data (e.g., Femas user IDs needed for punch)
    pub extra: std::collections::HashMap<String, String>,
}

#[async_trait]
pub trait HrModule: Send + Sync {
    async fn login(&self, username: &str, password: &str) -> Result<Session, HrError>;
    async fn is_holiday(&self, session: &Session, date: NaiveDate) -> Result<bool, HrError>;
    async fn has_personal_event(
        &self,
        session: &Session,
        date: NaiveDate,
        punch_type: PunchType,
        punch_time: chrono::NaiveTime,
    ) -> Result<bool, HrError>;
    async fn punch(&self, session: &Session, punch_type: PunchType) -> Result<PunchResult, HrError>;
    async fn logout(&self, session: &Session) -> Result<(), HrError>;
}
```

Note: `punch_time` added to `has_personal_event` — needed for the simplified event check (is punch time within event range?).

- [ ] **Step 2: Add `mod modules` to `lib.rs`**

```rust
mod config;
mod modules;
```

- [ ] **Step 3: Verify it compiles**

```bash
cd app/src-tauri && cargo check
```

Expected: compiles (mayo.rs and femas.rs don't exist yet — create empty files).

Create placeholder files:
```bash
touch app/src-tauri/src/modules/mayo.rs app/src-tauri/src/modules/femas.rs
```

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/modules/
git commit -m "feat(app): add HrModule trait, PunchType, Session, and error types"
```

---

### Task 5: Mayo module

**Files:**
- Create: `app/src-tauri/src/modules/mayo.rs`

This module replicates the login → calendar check → location fetch → punch flow from `cli/src/modules/mayo.js`.

- [ ] **Step 1: Write the Mayo struct and login**

```rust
use async_trait::async_trait;
use chrono::NaiveDate;
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, CONTENT_TYPE};
use scraper::{Html, Selector};

use super::{HrError, HrModule, PunchResult, PunchType, Session};

pub struct Mayo;

impl Mayo {
    pub fn new() -> Self {
        Mayo
    }

    fn parse_csrf_token(html: &str) -> Result<String, HrError> {
        let document = Html::parse_document(html);
        let selector = Selector::parse("[name=__RequestVerificationToken]")
            .map_err(|_| HrError::ParseError("invalid selector".into()))?;
        document
            .select(&selector)
            .next()
            .and_then(|el| el.value().attr("value"))
            .map(String::from)
            .ok_or_else(|| HrError::LoginFailed("no CSRF token found".into()))
    }
}

#[async_trait]
impl HrModule for Mayo {
    async fn login(&self, username: &str, password: &str) -> Result<Session, HrError> {
        let client = reqwest::Client::builder()
            .cookie_store(true)
            .build()?;

        // Step 1: GET login page for CSRF token
        let res = client
            .get("https://auth.mayohr.com/HRM/Account/Login")
            .send()
            .await?;
        let html = res.text().await?;
        let csrf_token = Self::parse_csrf_token(&html)?;

        // Step 2: POST login with credentials
        let params = [
            ("__RequestVerificationToken", csrf_token.as_str()),
            ("grant_type", "password"),
            ("password", password),
            ("userName", username),
            ("userStatus", "1"),
        ];
        let res = client
            .post("https://auth.mayohr.com/Token")
            .form(&params)
            .send()
            .await?;
        let json: serde_json::Value = res.json().await?;
        let code = json["code"]
            .as_str()
            .ok_or_else(|| HrError::LoginFailed("no code in login response".into()))?;

        // Step 3: Exchange code for session cookie
        client
            .get(format!(
                "https://authcommon.mayohr.com/api/auth/checkticket?code={}",
                code
            ))
            .send()
            .await?;

        Ok(Session { client, extra: std::collections::HashMap::new() })
    }

    async fn is_holiday(&self, session: &Session, date: NaiveDate) -> Result<bool, HrError> {
        let year = date.format("%Y").to_string();
        let month = date.format("%-m").to_string();
        let day = date.day() as usize;

        let url = format!(
            "https://apolloxe.mayohr.com/backend/pt/api/EmployeeCalendars/scheduling/V2?year={}&month={}",
            year, month
        );
        let res = session.client.get(&url).send().await?;
        let json: serde_json::Value = res.json().await?;

        let calendars = json["Data"]["Calendars"]
            .as_array()
            .ok_or_else(|| HrError::CalendarFailed("no Calendars in response".into()))?;

        let calendar_index = day - 1;
        let current_day = calendars
            .get(calendar_index)
            .ok_or_else(|| HrError::CalendarFailed("day index out of range".into()))?;

        let item_option_id = current_day["ItemOptionId"]
            .as_str()
            .unwrap_or("");

        // CY00003: recess day / public holiday
        // CY00004: regular day off
        Ok(item_option_id == "CY00003" || item_option_id == "CY00004")
    }

    async fn has_personal_event(
        &self,
        session: &Session,
        date: NaiveDate,
        _punch_type: PunchType,
        punch_time: chrono::NaiveTime,
    ) -> Result<bool, HrError> {
        let year = date.format("%Y").to_string();
        let month = date.format("%-m").to_string();
        let day = date.day() as usize;

        let url = format!(
            "https://apolloxe.mayohr.com/backend/pt/api/EmployeeCalendars/scheduling/V2?year={}&month={}",
            year, month
        );
        let res = session.client.get(&url).send().await?;
        let json: serde_json::Value = res.json().await?;

        let calendars = json["Data"]["Calendars"]
            .as_array()
            .ok_or_else(|| HrError::CalendarFailed("no Calendars in response".into()))?;

        let calendar_index = day - 1;
        let current_day = calendars
            .get(calendar_index)
            .ok_or_else(|| HrError::CalendarFailed("day index out of range".into()))?;

        let leave_sheets = match current_day["LeaveSheets"].as_array() {
            Some(sheets) if !sheets.is_empty() => sheets,
            _ => return Ok(false),
        };

        for sheet in leave_sheets {
            let start_str = sheet["LeaveStartDatetime"].as_str().unwrap_or("");
            let end_str = sheet["LeaveEndDatetime"].as_str().unwrap_or("");

            let start = chrono::NaiveDateTime::parse_from_str(start_str, "%Y-%m-%dT%H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(start_str, "%Y-%m-%dT%H:%M:%S%.f"));
            let end = chrono::NaiveDateTime::parse_from_str(end_str, "%Y-%m-%dT%H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(end_str, "%Y-%m-%dT%H:%M:%S%.f"));

            if let (Ok(start_dt), Ok(end_dt)) = (start, end) {
                let duration_hours = (end_dt - start_dt).num_hours();
                if duration_hours >= 9 {
                    return Ok(true); // all-day leave
                }
                let start_time = start_dt.time();
                let end_time = end_dt.time();
                if punch_time >= start_time && punch_time <= end_time {
                    return Ok(true); // punch time within event range
                }
            }
        }

        Ok(false)
    }

    async fn punch(&self, session: &Session, punch_type: PunchType) -> Result<PunchResult, HrError> {
        // Fetch location from API
        let res = session
            .client
            .get("https://apolloxe.mayohr.com/backend/pt/api/locations")
            .send()
            .await?;
        let json: serde_json::Value = res.json().await?;
        let locations = json["Data"]
            .as_array()
            .ok_or_else(|| HrError::PunchFailed("no location data".into()))?;
        let location = locations
            .first()
            .ok_or_else(|| HrError::PunchFailed("empty location list".into()))?;

        let latitude = &location["Latitude"];
        let longitude = &location["Longitude"];
        let location_id = &location["PunchesLocationId"];

        let attendance_type = match punch_type {
            PunchType::In => 1,
            PunchType::Out => 2,
        };

        let body = serde_json::json!({
            "AttendanceType": attendance_type,
            "Latitude": latitude,
            "Longitude": longitude,
            "PunchesLocationId": location_id,
        });

        let res = session
            .client
            .post("https://pt.mayohr.com/api/checkin/punch/locate")
            .json(&body)
            .send()
            .await?;
        let result: serde_json::Value = res.json().await?;

        let status = result["Meta"]["HttpStatusCode"]
            .as_str()
            .unwrap_or("");
        if status != "200" {
            return Err(HrError::PunchFailed(format!(
                "API returned status {}: {}",
                status,
                serde_json::to_string(&result).unwrap_or_default()
            )));
        }

        let punch_date = result["Data"]["punchDate"]
            .as_str()
            .unwrap_or("unknown");
        let time = chrono::NaiveDateTime::parse_from_str(punch_date, "%Y-%m-%dT%H:%M:%S")
            .or_else(|_| chrono::NaiveDateTime::parse_from_str(punch_date, "%Y-%m-%dT%H:%M:%S%.f"))
            .map(|dt| dt.format("%H:%M:%S").to_string())
            .unwrap_or_else(|_| punch_date.to_string());

        Ok(PunchResult { punch_type, time })
    }

    async fn logout(&self, session: &Session) -> Result<(), HrError> {
        let _ = session
            .client
            .get("https://auth.mayohr.com/api/accountapi/Logout")
            .send()
            .await;
        Ok(())
    }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd app/src-tauri && cargo check
```

Expected: compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src-tauri/src/modules/mayo.rs
git commit -m "feat(app): implement Mayo HR module (login, calendar, punch, logout)"
```

---

### Task 6: Femas module (stub)

**Files:**
- Create: `app/src-tauri/src/modules/femas.rs`

The existing Femas JS code has multiple bugs (see spec). This implements the structure from the API contract but marks it as needing real-world testing.

- [ ] **Step 1: Implement Femas struct**

Create `app/src-tauri/src/modules/femas.rs` following the same pattern as Mayo but targeting the Femas API endpoints:
- Login: `https://femascloud.com/{domain}/Accounts/login`
- Holidays: `https://femascloud.com/{domain}/Holidays/get_holidays`
- Events: `https://femascloud.com/{domain}/Holidays/get_events`
- Punch: `https://femascloud.com/{domain}/users/clock_listing`
- Logout: `https://femascloud.com/{domain}/accounts/logout`

```rust
use async_trait::async_trait;
use chrono::NaiveDate;
use scraper::{Html, Selector};

use super::{HrError, HrModule, PunchResult, PunchType, Session};

pub struct Femas {
    domain: String,
}

impl Femas {
    pub fn new(domain: String) -> Self {
        Femas { domain }
    }
}

#[async_trait]
impl HrModule for Femas {
    async fn login(&self, username: &str, password: &str) -> Result<Session, HrError> {
        let client = reqwest::Client::builder()
            .cookie_store(true)
            .build()?;

        // Step 1: GET landing page for session cookie
        client
            .get(format!("https://femascloud.com/{}/", self.domain))
            .send()
            .await?;

        // Step 2: POST login
        let params = [
            ("data[Account][username]", username),
            ("data[Account][passwd]", password),
            ("data[remember]", "0"),
        ];
        let res = client
            .post(format!(
                "https://femascloud.com/{}/Accounts/login",
                self.domain
            ))
            .form(&params)
            .send()
            .await?;
        let html = res.text().await?;

        let document = Html::parse_document(&html);
        let clock_selector = Selector::parse("#ClockRecordUserId")
            .map_err(|_| HrError::ParseError("invalid selector".into()))?;
        let att_selector = Selector::parse("#AttRecordUserId")
            .map_err(|_| HrError::ParseError("invalid selector".into()))?;

        let clock_id = document
            .select(&clock_selector)
            .next()
            .and_then(|el| el.value().attr("value"))
            .ok_or_else(|| HrError::LoginFailed("no ClockRecordUserId".into()))?
            .to_string();
        let att_id = document
            .select(&att_selector)
            .next()
            .and_then(|el| el.value().attr("value"))
            .ok_or_else(|| HrError::LoginFailed("no AttRecordUserId".into()))?
            .to_string();

        let mut extra = std::collections::HashMap::new();
        extra.insert("ClockRecordUserId".to_string(), clock_id);
        extra.insert("AttRecordUserId".to_string(), att_id);

        Ok(Session { client, extra })
    }

    async fn is_holiday(&self, session: &Session, date: NaiveDate) -> Result<bool, HrError> {
        let start = date.format("%Y-%m-01").to_string();
        let end_date = chrono::NaiveDate::from_ymd_opt(
            date.year(),
            date.month(),
            last_day_of_month(date.year(), date.month()),
        )
        .unwrap_or(date);
        let end = end_date.format("%Y-%m-%d").to_string();
        let today = date.format("%Y-%m-%d").to_string();

        let url = format!(
            "https://femascloud.com/{}/Holidays/get_holidays?start={}&end={}&_={}",
            self.domain, start, end, chrono::Utc::now().timestamp_millis()
        );
        let res = session.client.get(&url).send().await?;
        let holidays: Vec<serde_json::Value> = res.json().await
            .map_err(|e| HrError::CalendarFailed(e.to_string()))?;

        let is_holiday = holidays
            .iter()
            .any(|h| h["start"].as_str() == Some(today.as_str()));

        Ok(is_holiday)
    }

    async fn has_personal_event(
        &self,
        session: &Session,
        date: NaiveDate,
        _punch_type: PunchType,
        punch_time: chrono::NaiveTime,
    ) -> Result<bool, HrError> {
        let start = date.format("%Y-%m-01").to_string();
        let end_date = chrono::NaiveDate::from_ymd_opt(
            date.year(),
            date.month(),
            last_day_of_month(date.year(), date.month()),
        )
        .unwrap_or(date);
        let end = end_date.format("%Y-%m-%d").to_string();

        let url = format!(
            "https://femascloud.com/{}/Holidays/get_events?start={}&end={}&_={}",
            self.domain, start, end, chrono::Utc::now().timestamp_millis()
        );
        let res = session.client.get(&url).send().await?;
        let events: Vec<serde_json::Value> = res.json().await
            .map_err(|e| HrError::CalendarFailed(e.to_string()))?;

        let today_str = date.format("%Y-%m-%d").to_string();

        for event in &events {
            let start_str = event["startDateTime"].as_str().unwrap_or("");
            let end_str = event["endDateTime"].as_str().unwrap_or("");

            let start_dt = chrono::NaiveDateTime::parse_from_str(start_str, "%Y-%m-%dT%H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(start_str, "%Y-%m-%dT%H:%M:%S%.f"));
            let end_dt = chrono::NaiveDateTime::parse_from_str(end_str, "%Y-%m-%dT%H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(end_str, "%Y-%m-%dT%H:%M:%S%.f"));

            if let (Ok(s), Ok(e)) = (start_dt, end_dt) {
                if s.date().format("%Y-%m-%d").to_string() <= today_str
                    && e.date().format("%Y-%m-%d").to_string() >= today_str
                {
                    let duration_hours = (e - s).num_hours();
                    if duration_hours >= 9 {
                        return Ok(true);
                    }
                    if punch_time >= s.time() && punch_time <= e.time() {
                        return Ok(true);
                    }
                }
            }
        }

        Ok(false)
    }

    async fn punch(&self, session: &Session, punch_type: PunchType) -> Result<PunchResult, HrError> {
        let clock_id = session.extra.get("ClockRecordUserId")
            .ok_or_else(|| HrError::PunchFailed("missing ClockRecordUserId from login".into()))?;
        let att_id = session.extra.get("AttRecordUserId")
            .ok_or_else(|| HrError::PunchFailed("missing AttRecordUserId from login".into()))?;

        let clock_type = match punch_type {
            PunchType::In => "S",
            PunchType::Out => "E",
        };

        let params = [
            ("_method", "POST"),
            ("data[ClockRecord][user_id]", clock_id),
            ("data[AttRecord][user_id]", att_id),
            ("data[ClockRecord][shift_id]", "2"),
            ("data[ClockRecord][period]", "1"),
            ("data[ClockRecord][clock_type]", clock_type),
            ("data[ClockRecord][latitude]", ""),
            ("data[ClockRecord][longitude]", ""),
        ];

        let res = session
            .client
            .post(format!(
                "https://femascloud.com/{}/users/clock_listing",
                self.domain
            ))
            .header("x-requested-with", "XMLHttpRequest")
            .form(&params)
            .send()
            .await?;
        let html = res.text().await?;

        let document = Html::parse_document(&html);
        let selector = Selector::parse(".textBlue")
            .map_err(|_| HrError::ParseError("invalid selector".into()))?;

        let records: Vec<_> = document.select(&selector).collect();
        let time_text = match punch_type {
            PunchType::In => records.first(),
            PunchType::Out => records.get(1),
        }
        .map(|el| el.text().collect::<String>().trim().to_string())
        .ok_or_else(|| HrError::PunchFailed("no punch time in response".into()))?;

        if time_text.is_empty() {
            return Err(HrError::PunchFailed("empty punch time".into()));
        }

        Ok(PunchResult {
            punch_type,
            time: time_text,
        })
    }

    async fn logout(&self, session: &Session) -> Result<(), HrError> {
        let _ = session
            .client
            .get(format!(
                "https://femascloud.com/{}/accounts/logout",
                self.domain
            ))
            .send()
            .await;
        Ok(())
    }
}

fn last_day_of_month(year: i32, month: u32) -> u32 {
    chrono::NaiveDate::from_ymd_opt(
        if month == 12 { year + 1 } else { year },
        if month == 12 { 1 } else { month + 1 },
        1,
    )
    .unwrap()
    .pred_opt()
    .unwrap()
    .day()
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd app/src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add app/src-tauri/src/modules/femas.rs
git commit -m "feat(app): implement Femas HR module (stub, needs real-world testing)"
```

---

### Task 7: Daka core orchestration

**Files:**
- Create: `app/src-tauri/src/daka.rs`
- Modify: `app/src-tauri/src/lib.rs` (add `mod daka`)

This module maps to `cli/src/daka.js` — the retry-wrapped login → check → punch → logout flow.

- [ ] **Step 1: Write tests for the orchestration logic**

Create `app/src-tauri/src/daka.rs`:

```rust
use crate::modules::{HrError, HrModule, PunchResult, PunchType};
use chrono::{Local, NaiveDate, NaiveTime};
use log::{error, info};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

pub struct DakaService {
    module: Arc<dyn HrModule>,
    username: String,
    password: String,
    max_retries: u32,
}

#[derive(Debug, Clone)]
pub enum DakaOutcome {
    Success(PunchResult),
    Holiday,
    PersonalEvent,
    Failed(String),
}

impl DakaService {
    pub fn new(module: Arc<dyn HrModule>, username: String, password: String, max_retries: u32) -> Self {
        Self { module, username, password, max_retries }
    }

    pub async fn execute(&self, punch_type: PunchType, punch_time: NaiveTime) -> DakaOutcome {
        let today = Local::now().date_naive();
        let mut last_error = String::new();

        for attempt in 0..=self.max_retries {
            if attempt > 0 {
                info!("Retry attempt {}/{}", attempt, self.max_retries);
                sleep(Duration::from_secs(3)).await;
            }

            match self.try_punch(today, punch_type, punch_time).await {
                Ok(outcome) => return outcome,
                Err(e) => {
                    error!("Attempt {} failed: {}", attempt + 1, e);
                    last_error = e.to_string();
                }
            }
        }

        DakaOutcome::Failed(last_error)
    }

    async fn try_punch(
        &self,
        today: NaiveDate,
        punch_type: PunchType,
        punch_time: NaiveTime,
    ) -> Result<DakaOutcome, HrError> {
        let session = self.module.login(&self.username, &self.password).await?;

        let result = self.do_checks_and_punch(&session, today, punch_type, punch_time).await;

        // Always logout, even on error
        if let Err(e) = self.module.logout(&session).await {
            error!("Logout error (non-fatal): {}", e);
        }

        result
    }

    async fn do_checks_and_punch(
        &self,
        session: &crate::modules::Session,
        today: NaiveDate,
        punch_type: PunchType,
        punch_time: NaiveTime,
    ) -> Result<DakaOutcome, HrError> {
        // Check holiday
        if self.module.is_holiday(session, today).await? {
            info!("Today is a holiday, skipping punch");
            return Ok(DakaOutcome::Holiday);
        }

        // Check personal events
        if self.module.has_personal_event(session, today, punch_type, punch_time).await? {
            info!("Personal event found, skipping punch");
            return Ok(DakaOutcome::PersonalEvent);
        }

        // Execute punch
        let result = self.module.punch(session, punch_type).await?;
        info!("Punch success: {} at {}", punch_type.label(), result.time);

        Ok(DakaOutcome::Success(result))
    }
}
```

- [ ] **Step 2: Add `mod daka` to `lib.rs` and verify compilation**

```bash
cd app/src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add app/src-tauri/src/daka.rs app/src-tauri/src/lib.rs
git commit -m "feat(app): add DakaService core orchestration with retry logic"
```

---

## Chunk 3: App Integration

### Task 8: Scheduler

**Files:**
- Create: `app/src-tauri/src/scheduler.rs`
- Modify: `app/src-tauri/src/lib.rs` (add `mod scheduler`)

- [ ] **Step 1: Write tests for delay calculation**

Create `app/src-tauri/src/scheduler.rs`:

```rust
use chrono::{Local, NaiveTime, TimeDelta};
use rand::Rng;
use log::info;

/// Calculate a random delay in minutes within [min_mins, max_mins]
pub fn random_delay_mins(min_mins: u32, max_mins: u32) -> u32 {
    if min_mins >= max_mins {
        return min_mins;
    }
    let mut rng = rand::thread_rng();
    rng.gen_range(min_mins..=max_mins)
}

/// Calculate the actual punch time = base_time + delay
pub fn calculate_punch_time(base_time: NaiveTime, delay_mins: u32) -> NaiveTime {
    base_time + TimeDelta::minutes(delay_mins as i64)
}

/// Determine if a scheduled time should still execute (within tolerance)
pub fn should_execute(scheduled_time: NaiveTime, now: NaiveTime, tolerance_mins: u32) -> ShouldExecute {
    if now < scheduled_time {
        ShouldExecute::Wait
    } else {
        let elapsed = now - scheduled_time;
        let elapsed_mins = elapsed.num_minutes() as u32;
        if elapsed_mins <= tolerance_mins {
            ShouldExecute::ExecuteNow
        } else {
            ShouldExecute::Skip
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum ShouldExecute {
    Wait,
    ExecuteNow,
    Skip,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_random_delay_within_range() {
        for _ in 0..100 {
            let delay = random_delay_mins(0, 5);
            assert!(delay <= 5);
        }
    }

    #[test]
    fn test_random_delay_equal_min_max() {
        let delay = random_delay_mins(5, 5);
        assert_eq!(delay, 5);
    }

    #[test]
    fn test_calculate_punch_time() {
        let base = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        let result = calculate_punch_time(base, 5);
        assert_eq!(result, NaiveTime::from_hms_opt(9, 5, 0).unwrap());
    }

    #[test]
    fn test_should_execute_wait() {
        let scheduled = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        let now = NaiveTime::from_hms_opt(8, 50, 0).unwrap();
        assert_eq!(should_execute(scheduled, now, 30), ShouldExecute::Wait);
    }

    #[test]
    fn test_should_execute_now_within_tolerance() {
        let scheduled = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        let now = NaiveTime::from_hms_opt(9, 15, 0).unwrap();
        assert_eq!(should_execute(scheduled, now, 30), ShouldExecute::ExecuteNow);
    }

    #[test]
    fn test_should_execute_skip_past_tolerance() {
        let scheduled = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        let now = NaiveTime::from_hms_opt(9, 45, 0).unwrap();
        assert_eq!(should_execute(scheduled, now, 30), ShouldExecute::Skip);
    }

    #[test]
    fn test_should_execute_exact_time() {
        let scheduled = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        assert_eq!(should_execute(scheduled, scheduled, 30), ShouldExecute::ExecuteNow);
    }
}
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
cd app/src-tauri && cargo test --lib scheduler
```

Expected: all 7 tests PASS.

- [ ] **Step 3: Add the scheduler loop**

Add to `scheduler.rs`:

```rust
use crate::config::AppConfig;
use crate::daka::{DakaOutcome, DakaService};
use crate::modules::PunchType;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone)]
pub struct ScheduleEvent {
    pub punch_type: PunchType,
    pub outcome: DakaOutcome,
}

pub struct DailySchedule {
    pub punch_in_time: NaiveTime,
    pub punch_out_time: NaiveTime,
}

impl DailySchedule {
    pub fn new(config: &AppConfig) -> Self {
        let punch_in_base = NaiveTime::parse_from_str(&config.schedule.punch_in, "%H:%M")
            .unwrap_or_else(|_| NaiveTime::from_hms_opt(9, 0, 0).unwrap());
        let punch_out_base = NaiveTime::parse_from_str(&config.schedule.punch_out, "%H:%M")
            .unwrap_or_else(|_| NaiveTime::from_hms_opt(19, 0, 0).unwrap());

        let in_delay = random_delay_mins(0, config.schedule.delay_start_mins);
        let out_delay = random_delay_mins(
            config.schedule.delay_start_mins,
            config.schedule.delay_end_mins,
        );

        let punch_in_time = calculate_punch_time(punch_in_base, in_delay);
        let punch_out_time = calculate_punch_time(punch_out_base, out_delay);

        info!("Today's schedule: punch-in at {}, punch-out at {}", punch_in_time, punch_out_time);

        Self {
            punch_in_time,
            punch_out_time,
        }
    }
}

/// Run the scheduler loop. Sends ScheduleEvents through the channel for tray/notification updates.
pub async fn run_scheduler(
    daka_service: Arc<DakaService>,
    config: AppConfig,
    tx: mpsc::UnboundedSender<ScheduleEvent>,
) {
    loop {
        let schedule = DailySchedule::new(&config);
        let now = Local::now().time();

        // Punch-in
        match should_execute(schedule.punch_in_time, now, config.schedule.late_tolerance_mins) {
            ShouldExecute::Wait => {
                let wait_duration = (schedule.punch_in_time - now).to_std().unwrap_or(Duration::ZERO);
                info!("Waiting {} for punch-in", humanize_duration(wait_duration));
                sleep(wait_duration).await;
                let outcome = daka_service.execute(PunchType::In, schedule.punch_in_time).await;
                let _ = tx.send(ScheduleEvent { punch_type: PunchType::In, outcome });
            }
            ShouldExecute::ExecuteNow => {
                info!("Within tolerance, executing punch-in now");
                let outcome = daka_service.execute(PunchType::In, schedule.punch_in_time).await;
                let _ = tx.send(ScheduleEvent { punch_type: PunchType::In, outcome });
            }
            ShouldExecute::Skip => {
                info!("Punch-in time passed, skipping");
            }
        }

        // Punch-out
        let now = Local::now().time();
        match should_execute(schedule.punch_out_time, now, config.schedule.late_tolerance_mins) {
            ShouldExecute::Wait => {
                let wait_duration = (schedule.punch_out_time - now).to_std().unwrap_or(Duration::ZERO);
                info!("Waiting {} for punch-out", humanize_duration(wait_duration));
                sleep(wait_duration).await;
                let outcome = daka_service.execute(PunchType::Out, schedule.punch_out_time).await;
                let _ = tx.send(ScheduleEvent { punch_type: PunchType::Out, outcome });
            }
            ShouldExecute::ExecuteNow => {
                info!("Within tolerance, executing punch-out now");
                let outcome = daka_service.execute(PunchType::Out, schedule.punch_out_time).await;
                let _ = tx.send(ScheduleEvent { punch_type: PunchType::Out, outcome });
            }
            ShouldExecute::Skip => {
                info!("Punch-out time passed, skipping");
            }
        }

        // Wait until midnight for next day's schedule
        let now = Local::now();
        let tomorrow = (now.date_naive() + chrono::Duration::days(1))
            .and_hms_opt(0, 0, 30) // 30 seconds past midnight
            .unwrap();
        let until_midnight = tomorrow.signed_duration_since(now.naive_local());
        let wait = until_midnight.to_std().unwrap_or(Duration::from_secs(3600));
        info!("Waiting until midnight for next day's schedule");
        sleep(wait).await;
    }
}

fn humanize_duration(d: Duration) -> String {
    let secs = d.as_secs();
    let hours = secs / 3600;
    let mins = (secs % 3600) / 60;
    format!("{}h {}m", hours, mins)
}
```

- [ ] **Step 4: Add `mod scheduler` to `lib.rs` and verify compilation**

```bash
cd app/src-tauri && cargo check
```

- [ ] **Step 5: Run tests**

```bash
cd app/src-tauri && cargo test --lib scheduler
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src-tauri/src/scheduler.rs app/src-tauri/src/lib.rs
git commit -m "feat(app): add scheduler with delay calculation and daily loop"
```

---

### Task 9: System tray

**Files:**
- Create: `app/src-tauri/src/tray.rs`
- Modify: `app/src-tauri/src/lib.rs`

- [ ] **Step 1: Create tray module**

Create `app/src-tauri/src/tray.rs`:

```rust
use crate::daka::{DakaOutcome, DakaService};
use crate::modules::PunchType;
use crate::notification;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager,
};

pub struct TrayState {
    pub punch_in_status: String,
    pub punch_out_status: String,
    pub update_available: Option<String>,
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            punch_in_status: "○ 上班 等待中".to_string(),
            punch_out_status: "○ 下班 等待中".to_string(),
            update_available: None,
        }
    }
}

impl TrayState {
    pub fn set_scheduled(&mut self, punch_type: PunchType, time: &str) {
        let status = format!("○ {} 排程中 {}", punch_type.label(), time);
        match punch_type {
            PunchType::In => self.punch_in_status = status,
            PunchType::Out => self.punch_out_status = status,
        }
    }

    pub fn set_outcome(&mut self, punch_type: PunchType, outcome: &DakaOutcome) {
        let status = match outcome {
            DakaOutcome::Success(result) => {
                format!("● {} 已打卡 {}", punch_type.label(), result.time)
            }
            DakaOutcome::Holiday | DakaOutcome::PersonalEvent => {
                "— 今日休假".to_string()
            }
            DakaOutcome::Failed(_) => {
                format!("✕ {} 失敗", punch_type.label())
            }
        };
        match punch_type {
            PunchType::In => self.punch_in_status = status,
            PunchType::Out => self.punch_out_status = status,
        }
    }
}

/// Rebuild the tray menu to reflect current state. Call this after updating TrayState.
pub fn rebuild_tray_menu(app: &AppHandle, tray: &TrayIcon, state: &TrayState) -> Result<(), tauri::Error> {
    let menu = build_menu(app, state)?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

fn build_menu(app: &AppHandle, state: &TrayState) -> Result<Menu, tauri::Error> {
    let punch_in_status = MenuItem::with_id(app, "punch_in_status", &state.punch_in_status, false, None::<&str>)?;
    let punch_out_status = MenuItem::with_id(app, "punch_out_status", &state.punch_out_status, false, None::<&str>)?;
    let manual_in = MenuItem::with_id(app, "manual_in", "▶ 手動打卡（上班）", true, None::<&str>)?;
    let manual_out = MenuItem::with_id(app, "manual_out", "▶ 手動打卡（下班）", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "⚙ 設定", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "✕ 結束", true, None::<&str>)?;

    let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = vec![
        &punch_in_status,
        &punch_out_status,
        &manual_in,
        &manual_out,
        &settings,
    ];

    let update_item;
    if let Some(version) = &state.update_available {
        update_item = MenuItem::with_id(app, "update", &format!("🔄 有新版本 {}", version), true, None::<&str>)?;
        menu_items.push(&update_item);
    }

    menu_items.push(&quit);
    Menu::with_items(app, &menu_items)
}

pub fn build_tray(app: &AppHandle, state: &TrayState) -> Result<TrayIcon, tauri::Error> {
    let menu = build_menu(app, state)?;

    TrayIconBuilder::with_id(app, "daka")
        .tooltip("Daka")
        .menu(&menu)
        .menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "manual_in" | "manual_out" => {
                    let punch_type = if event.id().as_ref() == "manual_in" {
                        PunchType::In
                    } else {
                        PunchType::Out
                    };
                    log::info!("Manual {} triggered", punch_type.label());

                    if let Some(daka) = app.try_state::<Arc<DakaService>>() {
                        let daka = daka.inner().clone();
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let now = chrono::Local::now().time();
                            let outcome = daka.execute(punch_type, now).await;
                            notification::notify_outcome(&app_handle, punch_type, &outcome);
                        });
                    }
                }
                "settings" => {
                    // Open settings window
                    if let Some(window) = app.get_webview_window("settings") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        let _ = tauri::WebviewWindowBuilder::new(
                            app,
                            "settings",
                            tauri::WebviewUrl::App("settings.html".into()),
                        )
                        .title("Daka 設定")
                        .inner_size(480.0, 520.0)
                        .resizable(false)
                        .build();
                    }
                }
                "update" => {
                    // Open GitHub release page (Tauri v2 shell plugin)
                    use tauri_plugin_shell::ShellExt;
                    let _ = app.shell().open("https://github.com/user/daka/releases/latest", None::<&str>);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)
}
```

Note: The tray icon (`.png`) needs to be created. For now, use a placeholder or Tauri's default.

- [ ] **Step 2: Add `mod tray` to `lib.rs` and verify compilation**

```bash
cd app/src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add app/src-tauri/src/tray.rs app/src-tauri/src/lib.rs
git commit -m "feat(app): add system tray with menu, status display, and event handlers"
```

---

### Task 10: Notifications

**Files:**
- Create: `app/src-tauri/src/notification.rs`
- Modify: `app/src-tauri/src/lib.rs`

- [ ] **Step 1: Create notification helper**

Create `app/src-tauri/src/notification.rs`:

```rust
use crate::daka::DakaOutcome;
use crate::modules::PunchType;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify_outcome(app: &AppHandle, punch_type: PunchType, outcome: &DakaOutcome) {
    let (title, body) = match outcome {
        DakaOutcome::Success(result) => (
            "Daka".to_string(),
            format!("{}打卡成功 {}", punch_type.label(), result.time),
        ),
        DakaOutcome::Holiday | DakaOutcome::PersonalEvent => (
            "Daka".to_string(),
            "今日休假，跳過打卡".to_string(),
        ),
        DakaOutcome::Failed(err) => (
            "Daka".to_string(),
            format!("{}打卡失敗，請手動處理\n{}", punch_type.label(), err),
        ),
    };

    if let Err(e) = app.notification().builder().title(&title).body(&body).show() {
        log::error!("Failed to send notification: {}", e);
    }
}
```

- [ ] **Step 2: Add `mod notification` to `lib.rs` and verify compilation**

```bash
cd app/src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add app/src-tauri/src/notification.rs app/src-tauri/src/lib.rs
git commit -m "feat(app): add macOS notification helper for punch outcomes"
```

---

### Task 11: Tauri commands and frontend settings

**Files:**
- Create: `app/src-tauri/src/commands.rs`
- Create: `app/src/settings.html`
- Create: `app/src/style.css`
- Create: `app/src/main.js`
- Modify: `app/src-tauri/src/lib.rs`

- [ ] **Step 1: Create Tauri commands**

Create `app/src-tauri/src/commands.rs`:

```rust
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
```

- [ ] **Step 2: Register commands in `lib.rs`**

Update `lib.rs` to include:

```rust
mod commands;

// In the run() function:
.invoke_handler(tauri::generate_handler![
    commands::get_config,
    commands::save_config,
    commands::get_default_config,
])
```

- [ ] **Step 3: Create settings frontend**

Create `app/src/settings.html`:

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daka 設定</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Daka 設定</h1>

    <section>
      <h2>一般</h2>
      <label>
        模組
        <select id="module">
          <option value="mayo">Mayo</option>
          <option value="femas">Femas</option>
        </select>
      </label>
      <label>
        最大重試次數
        <input type="number" id="max_retries" min="0" max="10" value="3">
      </label>
    </section>

    <section>
      <h2>排程</h2>
      <label>上班時間 <input type="time" id="punch_in" value="09:00"></label>
      <label>下班時間 <input type="time" id="punch_out" value="19:00"></label>
      <label>延遲起始（分鐘）<input type="number" id="delay_start_mins" min="0" value="5"></label>
      <label>延遲結束（分鐘）<input type="number" id="delay_end_mins" min="0" value="15"></label>
      <label>遲到容許（分鐘）<input type="number" id="late_tolerance_mins" min="0" value="30"></label>
    </section>

    <section id="mayo_section">
      <h2>Mayo</h2>
      <label>帳號 <input type="text" id="mayo_username" autocomplete="off"></label>
      <label>密碼 <input type="password" id="mayo_password" autocomplete="off"></label>
    </section>

    <section id="femas_section" style="display:none">
      <h2>Femas</h2>
      <label>Domain <input type="text" id="femas_domain"></label>
      <label>帳號 <input type="text" id="femas_username" autocomplete="off"></label>
      <label>密碼 <input type="password" id="femas_password" autocomplete="off"></label>
    </section>

    <div class="actions">
      <button id="save_btn">儲存</button>
      <span id="status_msg"></span>
    </div>
  </div>

  <script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create CSS**

Create `app/src/style.css`:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 24px;
  background: #f5f5f7;
  color: #1d1d1f;
}

.container { max-width: 420px; margin: 0 auto; }

h1 { font-size: 20px; margin-bottom: 20px; }
h2 { font-size: 14px; color: #86868b; margin-bottom: 12px; text-transform: uppercase; }

section {
  background: white;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
  border-bottom: 1px solid #f0f0f0;
}

label:last-child { border-bottom: none; }

input, select {
  border: 1px solid #d2d2d7;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 14px;
  width: 180px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

button {
  background: #007aff;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
}

button:hover { background: #0056b3; }

#status_msg { font-size: 13px; color: #86868b; }
```

- [ ] **Step 5: Create frontend JavaScript**

Create `app/src/main.js`:

```javascript
const { invoke } = window.__TAURI__.core;

const moduleSelect = document.getElementById("module");
const mayoSection = document.getElementById("mayo_section");
const femasSection = document.getElementById("femas_section");

moduleSelect.addEventListener("change", () => {
  const isMayo = moduleSelect.value === "mayo";
  mayoSection.style.display = isMayo ? "block" : "none";
  femasSection.style.display = isMayo ? "none" : "block";
});

async function loadConfig() {
  try {
    const config = await invoke("get_config");
    applyConfig(config);
  } catch {
    const config = await invoke("get_default_config");
    applyConfig(config);
  }
}

function applyConfig(config) {
  moduleSelect.value = config.general.module;
  document.getElementById("max_retries").value = config.general.max_retries;
  document.getElementById("punch_in").value = config.schedule.punch_in;
  document.getElementById("punch_out").value = config.schedule.punch_out;
  document.getElementById("delay_start_mins").value = config.schedule.delay_start_mins;
  document.getElementById("delay_end_mins").value = config.schedule.delay_end_mins;
  document.getElementById("late_tolerance_mins").value = config.schedule.late_tolerance_mins;

  if (config.mayo) {
    document.getElementById("mayo_username").value = config.mayo.username;
    document.getElementById("mayo_password").value = config.mayo.password;
  }
  if (config.femas) {
    document.getElementById("femas_domain").value = config.femas.domain;
    document.getElementById("femas_username").value = config.femas.username;
    document.getElementById("femas_password").value = config.femas.password;
  }

  moduleSelect.dispatchEvent(new Event("change"));
}

document.getElementById("save_btn").addEventListener("click", async () => {
  const config = {
    general: {
      module: moduleSelect.value,
      max_retries: parseInt(document.getElementById("max_retries").value),
    },
    schedule: {
      punch_in: document.getElementById("punch_in").value,
      punch_out: document.getElementById("punch_out").value,
      delay_start_mins: parseInt(document.getElementById("delay_start_mins").value),
      delay_end_mins: parseInt(document.getElementById("delay_end_mins").value),
      late_tolerance_mins: parseInt(document.getElementById("late_tolerance_mins").value),
    },
    mayo: moduleSelect.value === "mayo" ? {
      username: document.getElementById("mayo_username").value,
      password: document.getElementById("mayo_password").value,
    } : null,
    femas: moduleSelect.value === "femas" ? {
      domain: document.getElementById("femas_domain").value,
      username: document.getElementById("femas_username").value,
      password: document.getElementById("femas_password").value,
    } : null,
  };

  const statusMsg = document.getElementById("status_msg");

  // Validate
  if (moduleSelect.value === "mayo") {
    if (!config.mayo.username || !config.mayo.password) {
      statusMsg.textContent = "請填寫帳號密碼";
      statusMsg.style.color = "#ff3b30";
      return;
    }
  } else {
    if (!config.femas.domain || !config.femas.username || !config.femas.password) {
      statusMsg.textContent = "請填寫所有欄位";
      statusMsg.style.color = "#ff3b30";
      return;
    }
  }

  try {
    await invoke("save_config", { config });
    statusMsg.textContent = "已儲存，請重新啟動 Daka 以套用變更";
    statusMsg.style.color = "#34c759";
  } catch (e) {
    statusMsg.textContent = "儲存失敗: " + e;
    statusMsg.style.color = "#ff3b30";
  }
});

loadConfig();
```

- [ ] **Step 6: Verify compilation**

```bash
cd app/src-tauri && cargo check
```

- [ ] **Step 7: Commit**

```bash
git add app/src-tauri/src/commands.rs app/src/settings.html app/src/style.css app/src/main.js app/src-tauri/src/lib.rs
git commit -m "feat(app): add Tauri commands and settings window frontend"
```

---

## Chunk 4: Polish & CI/CD

### Task 12: Wire up `lib.rs` — full app integration

**Files:**
- Modify: `app/src-tauri/src/lib.rs`
- Create: `app/src-tauri/capabilities/default.json`

This task wires all modules together in the Tauri app setup.

- [ ] **Step 1: Create Tauri v2 capabilities file**

Create `app/src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "windows": ["*"],
  "permissions": [
    "core:default",
    "notification:default",
    "shell:allow-open",
    "autostart:default"
  ]
}
```

This is required by Tauri v2 — without it, plugins are denied at runtime.

- [ ] **Step 2: Update `lib.rs` with full app setup**

```rust
mod config;
mod commands;
mod daka;
mod modules;
mod notification;
mod scheduler;
mod tray;
mod update_checker;

use config::AppConfig;
use daka::DakaService;
use modules::{mayo::Mayo, femas::Femas, HrModule, PunchType};
use std::sync::{Arc, Mutex};
use tray::TrayState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
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
            let handle = app.handle().clone();

            // Shared tray state
            let tray_state = Arc::new(Mutex::new(TrayState::default()));
            let _tray = tray::build_tray(&handle, &tray_state.lock().unwrap())?;

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

            // Start scheduler if configured
            if config.is_configured() {
                let config_clone = config.clone();
                let handle_clone = handle.clone();
                let tray_state_clone = tray_state.clone();

                let module: Arc<dyn HrModule> = match config.general.module.as_str() {
                    "femas" => {
                        let domain = config.femas.as_ref().map(|f| f.domain.clone()).unwrap_or_default();
                        Arc::new(Femas::new(domain))
                    }
                    _ => Arc::new(Mayo::new()),
                };

                let (username, password) = match config.general.module.as_str() {
                    "femas" => config.femas.as_ref()
                        .map(|f| (f.username.clone(), f.password.clone()))
                        .unwrap_or_default(),
                    _ => config.mayo.as_ref()
                        .map(|m| (m.username.clone(), m.password.clone()))
                        .unwrap_or_default(),
                };

                let daka_service = Arc::new(DakaService::new(
                    module, username, password, config.general.max_retries,
                ));

                // Store DakaService as Tauri managed state for manual punch access
                app.manage(daka_service.clone());

                let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

                // Spawn scheduler
                tauri::async_runtime::spawn(async move {
                    scheduler::run_scheduler(daka_service, config_clone, tx).await;
                });

                // Spawn event listener for tray updates + notifications
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
                        notification::notify_outcome(&handle_clone, event.punch_type, &event.outcome);
                    }
                });
            }

            // Check for updates
            let handle_for_update = handle.clone();
            let tray_state_for_update = tray_state.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(update) = update_checker::check_for_update().await {
                    log::info!("Update available: {}", update.version);
                    if let Ok(mut state) = tray_state_for_update.lock() {
                        state.update_available = Some(update.version);
                    }
                    // Rebuild tray to show update item
                    if let Some(tray_icon) = handle_for_update.tray_by_id("daka") {
                        if let Ok(state) = tray_state_for_update.lock() {
                            let _ = tray::rebuild_tray_menu(&handle_for_update, &tray_icon, &state);
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Key changes from initial version:
- `TrayState` is wrapped in `Arc<Mutex<>>` for shared access from the event listener
- `DakaService` is stored as Tauri managed state via `app.manage()` — enables manual punch from tray menu handlers
- Event listener updates tray state AND sends notifications
- Update checker is spawned at startup

**Note on config reload:** Saving new settings requires an app restart to take effect. The settings frontend should display a message after save: "設定已儲存，請重新啟動 Daka 以套用變更" (saved, restart to apply). This avoids complex scheduler restart logic for v1.

- [ ] **Step 3: Verify compilation**

```bash
cd app/src-tauri && cargo check
```

Fix any compilation errors that arise from wiring. Common issues:
- Import paths
- Missing trait implementations
- Type mismatches

- [ ] **Step 4: Commit**

```bash
git add app/src-tauri/src/lib.rs app/src-tauri/capabilities/default.json
git commit -m "feat(app): wire all modules together with tray state, managed state, and capabilities"
```

---

### Task 13: Update checker

**Files:**
- Create: `app/src-tauri/src/update_checker.rs`
- Modify: `app/src-tauri/src/lib.rs`

- [ ] **Step 1: Write update checker with test**

Create `app/src-tauri/src/update_checker.rs`:

```rust
use log::info;
use serde::Deserialize;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const GITHUB_RELEASE_URL: &str = "https://api.github.com/repos/USER/daka/releases/latest";

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
}

pub struct UpdateInfo {
    pub version: String,
    pub url: String,
}

pub async fn check_for_update() -> Option<UpdateInfo> {
    let client = reqwest::Client::new();
    let res = client
        .get(GITHUB_RELEASE_URL)
        .header("User-Agent", "daka-app")
        .send()
        .await
        .ok()?;

    let release: GitHubRelease = res.json().await.ok()?;
    let remote_version = release.tag_name.trim_start_matches('v');

    if is_newer(remote_version, CURRENT_VERSION) {
        info!("Update available: {} -> {}", CURRENT_VERSION, remote_version);
        Some(UpdateInfo {
            version: release.tag_name,
            url: release.html_url,
        })
    } else {
        info!("App is up to date ({})", CURRENT_VERSION);
        None
    }
}

fn is_newer(remote: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    let remote_parts = parse(remote);
    let current_parts = parse(current);
    remote_parts > current_parts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_patch() {
        assert!(is_newer("0.2.0", "0.1.0"));
    }

    #[test]
    fn test_is_newer_same() {
        assert!(!is_newer("0.1.0", "0.1.0"));
    }

    #[test]
    fn test_is_newer_older() {
        assert!(!is_newer("0.0.9", "0.1.0"));
    }

    #[test]
    fn test_is_newer_major() {
        assert!(is_newer("1.0.0", "0.9.9"));
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd app/src-tauri && cargo test --lib update_checker
```

Expected: all 4 tests PASS.

- [ ] **Step 3: Integrate into `lib.rs` setup**

In the `setup` closure, spawn the update check:

```rust
// After tray build
let handle_for_update = handle.clone();
tauri::async_runtime::spawn(async move {
    if let Some(update) = update_checker::check_for_update().await {
        // TODO: update tray state to show new version available
        log::info!("Update available: {}", update.version);
    }
});
```

- [ ] **Step 4: Add `mod update_checker` to `lib.rs` and verify compilation**

```bash
cd app/src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/src/update_checker.rs app/src-tauri/src/lib.rs
git commit -m "feat(app): add GitHub release update checker with version comparison"
```

---

### Task 14: CI/CD workflows

**Files:**
- Create: `.github/workflows/app-ci.yaml`
- Create: `.github/workflows/app-release.yaml`

- [ ] **Step 1: Create app CI workflow**

Create `.github/workflows/app-ci.yaml`:

```yaml
name: App CI

on:
  push:
    branches: [main]
    paths: ['app/**']
  pull_request:
    branches: [main]
    paths: ['app/**']

jobs:
  check:
    runs-on: macos-latest
    defaults:
      run:
        working-directory: ./app/src-tauri

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy

      - name: Rust cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: app/src-tauri

      - name: cargo check
        run: cargo check

      - name: cargo test
        run: cargo test

      - name: cargo clippy
        run: cargo clippy -- -D warnings
```

- [ ] **Step 2: Create app release workflow**

Create `.github/workflows/app-release.yaml`:

```yaml
name: App Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: macos-latest

    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: app/src-tauri

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install frontend deps
        working-directory: ./app
        run: npm install

      - name: Install Tauri CLI
        run: cargo install tauri-cli --version "^2.0.0"

      - name: Build Tauri app
        working-directory: ./app
        run: cargo tauri build

      - name: Upload to GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            app/src-tauri/target/release/bundle/dmg/*.dmg
            app/src-tauri/target/release/bundle/macos/*.app.tar.gz
```

- [ ] **Step 3: Update existing daka.yaml to use `cli/` working directory**

Ensure `.github/workflows/daka.yaml` has:

```yaml
defaults:
  run:
    working-directory: ./cli
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/app-ci.yaml .github/workflows/app-release.yaml
git commit -m "ci: add app CI and release workflows"
```

---

### Task 15: Smoke test — build and run

- [ ] **Step 1: Build the app in dev mode**

```bash
cd app && npm install && cd src-tauri && cargo tauri dev
```

Expected: app launches, tray icon appears in menu bar, settings window opens (first run).

- [ ] **Step 2: Test settings save/load**

Fill in dummy credentials in settings window, click save. Verify `~/.config/daka/config.toml` is created with correct values.

- [ ] **Step 3: Build production .dmg**

```bash
cd app/src-tauri && cargo tauri build
```

Expected: `.dmg` produced in `target/release/bundle/dmg/`.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(app): resolve compilation and runtime issues from smoke test"
```

---

## Task Dependency Summary

```
Task 1 (Move CLI) → Task 2 (Scaffold Tauri)
Task 2 → Task 3 (Config)
Task 3 → Task 4 (HrModule trait)
Task 4 → Task 5 (Mayo) + Task 6 (Femas)  [parallel]
Task 5 + Task 6 → Task 7 (DakaService)
Task 7 → Task 8 (Scheduler)
Task 7 → Task 9 (Tray)     [depends on DakaOutcome, PunchType]
Task 7 → Task 10 (Notifications)  [depends on DakaOutcome, PunchType]
Task 3 → Task 11 (Commands + Frontend)
Task 8 + Task 9 + Task 10 + Task 11 → Task 12 (Wire up lib.rs)
Task 4 → Task 13 (Update checker)  [only needs to compile, minimal deps]
Task 12 → Task 14 (CI/CD)
Task 12 + Task 13 + Task 14 → Task 15 (Smoke test)
```

**Parallelizable tasks:**
- Tasks 5 & 6 (Mayo & Femas modules)
- Tasks 9, 10, & 11 (Tray, Notifications, Commands — after Task 7)
- Tasks 13 & 14 (Update checker & CI/CD)
