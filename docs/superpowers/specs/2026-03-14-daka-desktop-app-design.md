# Daka Desktop App — Design Spec

## Overview

Convert the existing Daka automated attendance system from a GitHub Actions / cron-driven CLI into a macOS menu bar desktop app using **Tauri** (Rust backend + HTML/CSS/JS frontend). The core punch-in/punch-out logic will be rewritten in Rust.

## Goals

- Eliminate dependency on GitHub Actions, crontab, or Docker for scheduling
- Run as a persistent macOS menu bar app with built-in scheduler
- Provide a settings UI to configure credentials and schedule (replacing `.env`)
- Preserve all existing behavior: login, holiday/event check, punch, retry, random delay
- Auto-start on macOS login

## Non-Goals (First Version)

- Windows / Linux support
- Punch history or calendar view
- macOS Keychain integration for passwords (planned for v2)
- Login with SSO / OAuth
- `IMMEDIATE_DAKA` flag (superseded by Manual Punch in the tray menu)

## Known Issues in Existing CLI Code

The following bugs exist in the current Femas module (`cli/src/modules/femas.js`) and should NOT be carried over to the Rust rewrite:

- `_login()` called without `this.` — throws `ReferenceError` at runtime
- `checkDakaDay()` references unbound `punchType` variable (method signature lacks it)
- Duplicate `punch()` method — second definition shadows the real implementation
- Import path `../resource` should be `../utils/resource`

These indicate the Femas module may not be functional in its current state. The Rust rewrite should reconstruct Femas behavior from the API contract (endpoints, request/response format) rather than translating the buggy JS line-by-line.

## Project Structure

```
daka/
├── cli/                    # Existing Node.js CLI (moved from root)
│   ├── src/
│   │   ├── index.js
│   │   ├── daka.js
│   │   ├── env.js
│   │   ├── modules/
│   │   └── utils/
│   ├── package.json
│   └── Dockerfile
│
├── app/                    # New Tauri desktop app
│   ├── src-tauri/          # Rust backend (Tauri convention)
│   │   ├── src/
│   │   │   ├── main.rs              # Tauri entry point
│   │   │   ├── tray.rs              # System tray menu & status updates
│   │   │   ├── scheduler.rs         # Scheduler (tokio timer)
│   │   │   ├── config.rs            # ConfigManager (read/write TOML)
│   │   │   ├── notification.rs      # macOS native notifications
│   │   │   ├── daka.rs              # Core orchestration (maps to daka.js)
│   │   │   ├── commands.rs          # Tauri commands (frontend <-> backend)
│   │   │   └── modules/
│   │   │       ├── mod.rs           # HrModule trait definition
│   │   │       ├── mayo.rs          # Mayo HR implementation
│   │   │       └── femas.rs         # Femas HR implementation
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   ├── src/                # Frontend (settings window)
│   │   ├── index.html
│   │   ├── settings.html
│   │   ├── style.css
│   │   └── main.js
│   └── package.json
│
├── .github/workflows/      # Retained, points to cli/
└── README.md
```

## Architecture

### Core Trait

```rust
#[async_trait]
pub trait HrModule: Send + Sync {
    async fn login(&self, username: &str, password: &str) -> Result<Session>;
    async fn is_holiday(&self, session: &Session, date: NaiveDate) -> Result<bool>;
    async fn has_personal_event(&self, session: &Session, date: NaiveDate, punch_type: PunchType) -> Result<bool>;
    async fn punch(&self, session: &Session, punch_type: PunchType) -> Result<PunchResult>;
    async fn logout(&self, session: &Session) -> Result<()>;
}
```

Implemented by `Mayo` and `Femas` structs. Module-specific configuration (e.g., Femas `domain`, Mayo API base URLs) is injected at construction time via each struct's `new()` method, not through the trait interface.

### Rust Crate Dependencies

| Purpose | Crate | Replaces (JS) |
|---------|-------|---------------|
| HTTP client | `reqwest` (with cookie jar) | `fetch` |
| HTML parsing | `scraper` | `cheerio` |
| Date/time | `chrono` + `chrono-tz` | `date-fns` |
| Config file | `serde` + `toml` | `dotenv` |
| Scheduling | `tokio::time` | GitHub Actions cron |
| Notifications | Tauri notification plugin | N/A |
| Serialization | `serde_json` | native JSON |
| Async runtime | `tokio` (Tauri built-in) | Node.js event loop |

### Frontend

Plain HTML/CSS/JS — no framework. The settings window is a simple form:

- Module selection (Mayo / Femas)
- Username, password
- Punch-in / punch-out times
- Delay range settings
- Module-specific options (domain for Femas)
- Save button calls Tauri commands to write `config.toml`

## Configuration

File location: `~/.config/daka/config.toml`

The existing `MODULE_OPTIONS` env var is replaced by module-specific config sections (`[mayo]`, `[femas]`). No generic passthrough is needed.

```toml
[general]
module = "mayo"          # "mayo" or "femas"
max_retries = 3

[schedule]
punch_in = "09:00"
punch_out = "19:00"
delay_start_mins = 5     # punch-in: random(0, delay_start_mins) minutes
delay_end_mins = 15      # punch-out: random(delay_start_mins, delay_end_mins) minutes
late_tolerance_mins = 30  # if app opens late, still punch within this window. 0 = no late punch

[mayo]
username = ""
password = ""

[femas]
domain = ""
username = ""
password = ""
```

### Delay Logic (Preserved from Existing Code)

- **Punch-in (S)**: `random(0, delay_start_mins)` minutes — default 0~5 min
- **Punch-out (E)**: `random(delay_start_mins, delay_end_mins)` minutes — default 5~15 min
- Random values are calculated once per day at midnight (or app startup), not per trigger

### Timezone

The app uses the **system's local timezone** (via `chrono::Local`). The existing CLI's hardcoded CST offset (`TIMEZONE_MINUTE_OFFSET = 480`) is not carried over — the desktop app inherits the user's macOS timezone setting.

## Scheduler Behavior

```
App startup
  │
  ├─ Load config from ~/.config/daka/config.toml
  │   └─ If config not found → create default config, open settings window
  │
  ├─ Calculate today's trigger times
  │   punch_in_time  = punch_in + random(0, delay_start_mins)
  │   punch_out_time = punch_out + random(delay_start_mins, delay_end_mins)
  │
  ├─ For each trigger time:
  │   if now > trigger_time + late_tolerance_mins → skip
  │   if now > trigger_time but within tolerance → execute immediately
  │   else → tokio::time::sleep_until(trigger_time)
  │
  └─ Daily midnight: recalculate random delays for the next day
```

### Trigger Execution

```
1. Login to HR system
2. Check if today is a holiday → skip if yes
3. Check for personal events (leave) → skip if yes
4. Execute punch
5. Logout (unconditionally, even on error, to ensure session cleanup)
6. Update tray status
7. Send macOS notification

On failure at ANY step (1-4):
  → Wait 3 seconds
  → Retry entire flow from step 1 (up to max_retries)
  → After all retries exhausted: update tray to failure state, send failure notification
```

This matches the existing CLI behavior where the entire login-through-punch flow is retried, not just the punch step.

### Personal Event Logic (60-Minute Proximity Rule)

When checking personal events (leave/vacation), an event blocks the punch if:

- The event covers 9+ hours → treated as all-day leave, always skip
- The current time falls between the event's start and end
- **Punch-in (S)**: the event starts within 60 minutes of the current time
- **Punch-out (E)**: the event ended within 60 minutes of the current time

This proximity rule prevents punching in right before a leave starts, or punching out right after a leave ends.

### Mayo Location

The Mayo module fetches the punch location (latitude, longitude, location ID) from the Mayo API at runtime (`/backend/pt/api/locations`). Location is NOT user-configured — it uses whatever the HR system returns.

### Failure Recovery

- After all retries are exhausted, the tray shows failure state (`✕ 上班 失敗`)
- The user can use **Manual Punch** from the tray menu to retry at any time
- Punch state is **transient** — not persisted across app restarts. On restart, the scheduler recalculates from scratch
- All punch attempts and errors are logged to stdout (visible via `Console.app` or `log stream`)

## System Tray

### Menu Structure

```
┌──────────────────────────┐
│  ● 上班 已打卡 09:03      │  ← Today's status
│  ○ 下班 排程中 19:12      │
│  ─────────────────────── │
│  ▶ 手動打卡（上班）       │  ← Manual trigger (no delay)
│  ▶ 手動打卡（下班）       │
│  ─────────────────────── │
│  ⚙ 設定                  │  ← Opens settings window
│  ✕ 結束                  │
└──────────────────────────┘
```

### Status Display Logic

| Scenario | Display |
|----------|---------|
| Before scheduled time | `○ 上班 排程中 09:03` |
| Punch succeeded | `● 上班 已打卡 09:03` |
| Punch failed (all retries exhausted) | `✕ 上班 失敗` |
| Holiday or on leave | `— 今日休假` |

### Manual Punch

Executes immediately without delay. Intended as a fallback when the schedule is missed or the user wants to punch early.

## Notifications

macOS native notifications via Tauri notification plugin:

- Success: `Daka — 上班打卡成功 09:03`
- Failure: `Daka — 上班打卡失敗，請手動處理`
- Holiday/Leave: `Daka — 今日休假，跳過打卡`

## Auto-Start on Login

Register a macOS LaunchAgent (`~/Library/LaunchAgents/com.daka.app.plist`) so the app starts automatically on user login. This is essential for an attendance app — if the user forgets to open it, punches are missed.

Tauri provides a plugin (`tauri-plugin-autostart`) for this. The setting can be toggled in the settings window.

## First-Run Experience

On first launch (no `~/.config/daka/config.toml` exists):

1. Create default config file with empty credentials
2. Automatically open the settings window
3. Scheduler does not start until credentials are configured and saved
4. Validate that username/password are non-empty before allowing save

## CI/CD

The existing CLI CI/CD (Docker image build + push) is retained unchanged under `.github/workflows/`.

### App — PR / Push to main

```
→ cargo check
→ cargo test
→ cargo clippy (lint)
```

Ensures the Rust backend compiles, tests pass, and there are no lint warnings.

### App — Release (Push tag `v*`)

```
→ cargo test
→ tauri build (produces .dmg)
→ Upload .dmg to GitHub Release
```

No code signing (no Apple Developer account). Users must bypass Gatekeeper on first install (`xattr -cr Daka.app`).

### In-App Update Check

No Tauri auto-updater (requires code signing). Instead, a lightweight version check:

1. On app startup, call GitHub API: `GET /repos/{owner}/{repo}/releases/latest`
2. Compare `tag_name` against the app's built-in version
3. If a newer version exists, add a tray menu item: `🔄 有新版本 v1.1.0`
4. Clicking it opens the GitHub Release page in the default browser

No update server, no signing, no additional infrastructure needed.

## Future Improvements (Not in Scope)

- macOS Keychain for password storage (low migration cost via `keyring` crate)
- Punch history / calendar view
- Cross-platform support (Tauri supports Windows/Linux)
- Code signing + Tauri auto-updater (requires Apple Developer Program, $99/year)
