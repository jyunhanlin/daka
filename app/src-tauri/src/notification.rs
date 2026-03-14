use crate::daka::DakaOutcome;
use crate::modules::PunchType;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify_outcome<R: tauri::Runtime>(app: &AppHandle<R>, punch_type: PunchType, outcome: &DakaOutcome) {
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
