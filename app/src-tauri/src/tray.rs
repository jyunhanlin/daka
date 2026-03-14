use crate::daka::{DakaOutcome, DakaService};
use crate::modules::PunchType;
use log::error;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager,
};

// ---------------------------------------------------------------------------
// TrayState
// ---------------------------------------------------------------------------

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
    /// Update status to scheduled state, e.g. "○ 上班 排程中 09:03"
    pub fn set_scheduled(&mut self, punch_type: PunchType, time_str: &str) {
        let label = punch_type.label();
        let status = format!("○ {} 排程中 {}", label, time_str);
        match punch_type {
            PunchType::In => self.punch_in_status = status,
            PunchType::Out => self.punch_out_status = status,
        }
    }

    /// Update status based on a DakaOutcome.
    pub fn set_outcome(&mut self, punch_type: PunchType, outcome: &DakaOutcome) {
        let status = match outcome {
            DakaOutcome::Success(result) => {
                format!("● {} 已打卡 {}", punch_type.label(), result.time)
            }
            DakaOutcome::Holiday | DakaOutcome::PersonalEvent => "— 今日休假".to_string(),
            DakaOutcome::Failed(_) => format!("✕ {} 失敗", punch_type.label()),
        };
        match punch_type {
            PunchType::In => self.punch_in_status = status,
            PunchType::Out => self.punch_out_status = status,
        }
    }
}

// ---------------------------------------------------------------------------
// Menu builder
// ---------------------------------------------------------------------------

pub fn build_menu<R: tauri::Runtime>(
    app: &AppHandle<R>,
    state: &TrayState,
) -> tauri::Result<Menu<R>> {
    let punch_in_item =
        MenuItem::with_id(app, "punch_in_status", &state.punch_in_status, false, None::<&str>)?;
    let punch_out_item = MenuItem::with_id(
        app,
        "punch_out_status",
        &state.punch_out_status,
        false,
        None::<&str>,
    )?;

    let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;

    let manual_in = MenuItem::with_id(app, "manual_in", "▶ 手動打卡（上班）", true, None::<&str>)?;
    let manual_out =
        MenuItem::with_id(app, "manual_out", "▶ 手動打卡（下班）", true, None::<&str>)?;

    let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;

    let settings = MenuItem::with_id(app, "settings", "⚙ 設定", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "✕ 結束", true, None::<&str>)?;

    let mut items: Vec<&dyn tauri::menu::IsMenuItem<R>> = vec![
        &punch_in_item,
        &punch_out_item,
        &sep1,
        &manual_in,
        &manual_out,
        &sep2,
    ];

    // Optional update item — must be kept alive for the duration of items
    let update_item;
    if let Some(version) = &state.update_available {
        let label = format!("🔄 有新版本 {}", version);
        update_item = Some(MenuItem::with_id(app, "update", label, true, None::<&str>)?);
        if let Some(ref item) = update_item {
            items.push(item);
        }
    } else {
        update_item = None;
    }

    // Silence unused warning: update_item must stay alive until Menu::with_items returns
    let _ = &update_item;

    items.push(&settings);
    items.push(&quit);

    Menu::with_items(app, &items)
}

// ---------------------------------------------------------------------------
// Tray helpers
// ---------------------------------------------------------------------------

pub fn rebuild_tray_menu<R: tauri::Runtime>(
    app: &AppHandle<R>,
    tray: &TrayIcon<R>,
    state: &TrayState,
) -> tauri::Result<()> {
    let menu = build_menu(app, state)?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

pub fn build_tray<R: tauri::Runtime>(
    app: &AppHandle<R>,
    state: &TrayState,
) -> tauri::Result<TrayIcon<R>> {
    let menu = build_menu(app, state)?;

    TrayIconBuilder::with_id("daka")
        .tooltip("Daka — 自動打卡")
        .menu(&menu)
        .on_menu_event(handle_menu_event)
        .build(app)
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

fn handle_menu_event<R: tauri::Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "manual_in" => spawn_manual_punch(app.clone(), PunchType::In),
        "manual_out" => spawn_manual_punch(app.clone(), PunchType::Out),
        "settings" => open_settings_window(app),
        "update" => open_update_page(app),
        "quit" => std::process::exit(0),
        _ => {}
    }
}

fn spawn_manual_punch<R: tauri::Runtime>(app: AppHandle<R>, punch_type: PunchType) {
    let Some(daka) = app.try_state::<Arc<DakaService>>() else {
        error!("DakaService not available in managed state");
        return;
    };
    let daka = Arc::clone(&daka);

    tauri::async_runtime::spawn(async move {
        let now = chrono::Local::now().time();
        let outcome = daka.execute(punch_type, now).await;

        let (title, body) = notification_message(punch_type, &outcome);
        if let Err(e) = send_notification(&app, &title, &body) {
            error!("Failed to send notification: {}", e);
        }
    });
}

fn notification_message(punch_type: PunchType, outcome: &DakaOutcome) -> (String, String) {
    let label = punch_type.label();
    match outcome {
        DakaOutcome::Success(result) => (
            format!("打卡成功 — {}", label),
            format!("已於 {} 打卡", result.time),
        ),
        DakaOutcome::Holiday | DakaOutcome::PersonalEvent => {
            ("今日休假".to_string(), "偵測到假期或個人事項，跳過打卡".to_string())
        }
        DakaOutcome::Failed(reason) => {
            (format!("打卡失敗 — {}", label), reason.clone())
        }
    }
}

fn send_notification<R: tauri::Runtime>(
    app: &AppHandle<R>,
    title: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()?;
    Ok(())
}

fn open_settings_window<R: tauri::Runtime>(app: &AppHandle<R>) {
    // If the window already exists, focus it; otherwise create it.
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    match tauri::WebviewWindowBuilder::new(
        app,
        "settings",
        tauri::WebviewUrl::App("settings.html".into()),
    )
    .title("Daka 設定")
    .inner_size(480.0, 520.0)
    .resizable(false)
    .build()
    {
        Ok(window) => {
            let _ = window.show();
        }
        Err(e) => error!("Failed to open settings window: {}", e),
    }
}

fn open_update_page<R: tauri::Runtime>(app: &AppHandle<R>) {
    use tauri_plugin_shell::ShellExt;
    let url = "https://github.com/jhlin/daka/releases/latest";
    // shell().open() is deprecated in favour of tauri-plugin-opener, but that
    // plugin is not yet in our dependencies. Suppress the warning until we migrate.
    #[allow(deprecated)]
    if let Err(e) = app.shell().open(url, None) {
        error!("Failed to open update URL: {}", e);
    }
}
