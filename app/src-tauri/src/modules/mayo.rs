use async_trait::async_trait;
use chrono::{Datelike, NaiveDate, NaiveDateTime, NaiveTime, Timelike};
use scraper::{Html, Selector};
use serde::Deserialize;
use std::collections::HashMap;

use super::{HrError, HrModule, PunchResult, PunchType, Session};

#[derive(Default)]
pub struct Mayo;

impl Mayo {
    pub fn new() -> Self {
        Mayo
    }
}

// ── JSON shapes ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct TokenResponse {
    code: Option<String>,
}

#[derive(Deserialize)]
struct CalendarResponse {
    #[serde(rename = "Data")]
    data: CalendarData,
}

#[derive(Deserialize)]
struct CalendarData {
    #[serde(rename = "Calendars")]
    calendars: Option<Vec<CalendarDay>>,
}

#[derive(Deserialize)]
struct CalendarDay {
    #[serde(rename = "ItemOptionId")]
    item_option_id: Option<String>,
    #[serde(rename = "LeaveSheets")]
    leave_sheets: Option<Vec<LeaveSheet>>,
}

#[derive(Deserialize)]
struct LeaveSheet {
    #[serde(rename = "LeaveStartDatetime")]
    leave_start_datetime: String,
    #[serde(rename = "LeaveEndDatetime")]
    leave_end_datetime: String,
}

#[derive(Deserialize)]
struct LocationResponse {
    #[serde(rename = "Data")]
    data: Option<Vec<Location>>,
}

#[derive(Deserialize)]
struct Location {
    #[serde(rename = "Latitude")]
    latitude: f64,
    #[serde(rename = "Longitude")]
    longitude: f64,
    #[serde(rename = "PunchesLocationId")]
    punches_location_id: String,
}

#[derive(Deserialize)]
struct PunchResponse {
    #[serde(rename = "Meta")]
    meta: Option<PunchMeta>,
    #[serde(rename = "Data")]
    data: Option<PunchData>,
}

#[derive(Deserialize)]
struct PunchMeta {
    #[serde(rename = "HttpStatusCode")]
    http_status_code: Option<String>,
}

#[derive(Deserialize)]
struct PunchData {
    #[serde(rename = "punchDate")]
    punch_date: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Parse datetime strings in either `%Y-%m-%dT%H:%M:%S` or
/// `%Y-%m-%dT%H:%M:%S%.f` format (fractional seconds are optional).
fn parse_datetime(s: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S"))
        .ok()
}

/// Return `true` when the punch should be skipped because a leave event covers
/// the given date/time.  Mirrors `checkPersonalEvents` from the JS implementation.
fn event_covers_punch(
    sheets: &[LeaveSheet],
    date: NaiveDate,
    _punch_type: PunchType,
    punch_time: NaiveTime,
) -> bool {
    for sheet in sheets {
        let start_dt = match parse_datetime(&sheet.leave_start_datetime) {
            Some(dt) => dt,
            None => continue,
        };
        let end_dt = match parse_datetime(&sheet.leave_end_datetime) {
            Some(dt) => dt,
            None => continue,
        };

        let start_date = start_dt.date();
        let end_date = end_dt.date();

        // Determine this day's effective time window across multi-day events.
        let (event_date, day_start_time, day_end_time) = if start_date == end_date {
            (start_date, start_dt.time(), end_dt.time())
        } else {
            if date < start_date || date > end_date {
                continue;
            }
            let default_start = NaiveTime::from_hms_opt(10, 0, 0).unwrap();
            let default_end = NaiveTime::from_hms_opt(19, 0, 0).unwrap();
            if date == start_date {
                (date, start_dt.time(), default_end)
            } else if date == end_date {
                (date, default_start, end_dt.time())
            } else {
                (date, default_start, default_end)
            }
        };

        if event_date != date {
            continue;
        }

        // All-day: hour difference ≥ 9 → skip punch.
        let duration_hours = (day_end_time.hour() as i32) - (day_start_time.hour() as i32);
        if duration_hours >= 9 {
            return true;
        }

        // Punch time falls within the event window → skip.
        // The 60-minute proximity buffer from the CLI version is intentionally
        // dropped — the desktop app's scheduler is precise, so a simple
        // time-range check is sufficient.
        if punch_time >= day_start_time && punch_time <= day_end_time {
            return true;
        }
    }

    false
}

// ── Private helpers ──────────────────────────────────────────────────────────

impl Mayo {
    /// Fetch the calendar for the given date's month. Both `is_holiday` and
    /// `has_personal_event` need the same data, so callers can reuse the result.
    async fn fetch_calendar_day(
        session: &Session,
        date: NaiveDate,
    ) -> Result<CalendarDay, HrError> {
        let url = format!(
            "https://apolloxe.mayohr.com/backend/pt/api/EmployeeCalendars/scheduling/V2?year={}&month={}",
            date.year(),
            date.month()
        );

        let resp: CalendarResponse = session.client.get(&url).send().await?.json().await?;

        let calendars = resp
            .data
            .calendars
            .ok_or_else(|| HrError::CalendarFailed("no Calendars array".into()))?;

        let day_index = (date.day() as usize).saturating_sub(1);
        calendars
            .into_iter()
            .nth(day_index)
            .ok_or_else(|| HrError::CalendarFailed("day index out of range".into()))
    }
}

// ── HrModule impl ─────────────────────────────────────────────────────────────

#[async_trait]
impl HrModule for Mayo {
    async fn login(&self, username: &str, password: &str) -> Result<Session, HrError> {
        let client = reqwest::Client::builder()
            .cookie_store(true)
            .build()
            .map_err(HrError::NetworkError)?;

        // Step 1 — GET login page, parse CSRF token.
        let html = client
            .get("https://auth.mayohr.com/HRM/Account/Login")
            .send()
            .await?
            .text()
            .await?;

        // Parse the CSRF token synchronously and drop the `Html` document
        // before the next `.await` — `Html` is not `Send` (uses non-atomic
        // refcounting internally), so it must not be held across await points.
        let csrf_token = {
            let document = Html::parse_document(&html);
            let selector = Selector::parse("[name=__RequestVerificationToken]")
                .map_err(|e| HrError::ParseError(format!("selector error: {:?}", e)))?;
            document
                .select(&selector)
                .next()
                .and_then(|el| el.value().attr("value"))
                .ok_or_else(|| HrError::LoginFailed("no CSRF token found".into()))?
                .to_string()
        };

        // Step 2 — POST credentials, get one-time code.
        let form = [
            ("__RequestVerificationToken", csrf_token.as_str()),
            ("grant_type", "password"),
            ("password", password),
            ("userName", username),
            ("userStatus", "1"),
        ];

        let token_resp: TokenResponse = client
            .post("https://auth.mayohr.com/Token")
            .form(&form)
            .send()
            .await?
            .json()
            .await?;

        let code = token_resp
            .code
            .ok_or_else(|| HrError::LoginFailed("no code in token response".into()))?;

        // Step 3 — Exchange code for session cookie (cookie jar handles storage).
        client
            .get(format!(
                "https://authcommon.mayohr.com/api/auth/checkticket?code={code}"
            ))
            .send()
            .await?;

        Ok(Session {
            client,
            extra: HashMap::new(),
        })
    }

    async fn is_holiday(&self, session: &Session, date: NaiveDate) -> Result<bool, HrError> {
        let day = Self::fetch_calendar_day(session, date).await?;
        let option_id = day.item_option_id.as_deref().unwrap_or("");
        Ok(option_id == "CY00003" || option_id == "CY00004")
    }

    async fn has_personal_event(
        &self,
        session: &Session,
        date: NaiveDate,
        punch_type: PunchType,
        punch_time: NaiveTime,
    ) -> Result<bool, HrError> {
        let day = Self::fetch_calendar_day(session, date).await?;
        let sheets = match &day.leave_sheets {
            Some(s) if !s.is_empty() => s,
            _ => return Ok(false),
        };
        Ok(event_covers_punch(sheets, date, punch_type, punch_time))
    }

    async fn punch(
        &self,
        session: &Session,
        punch_type: PunchType,
    ) -> Result<PunchResult, HrError> {
        // Fetch first available location.
        let loc_resp: LocationResponse = session
            .client
            .get("https://apolloxe.mayohr.com/backend/pt/api/locations")
            .send()
            .await?
            .json()
            .await?;

        let locations = loc_resp
            .data
            .ok_or_else(|| HrError::PunchFailed("no location data".into()))?;

        let location = locations
            .into_iter()
            .next()
            .ok_or_else(|| HrError::PunchFailed("location list is empty".into()))?;

        // AttendanceType: 1 = punch in, 2 = punch out
        let attendance_type: u8 = match punch_type {
            PunchType::In => 1,
            PunchType::Out => 2,
        };

        let body = serde_json::json!({
            "AttendanceType": attendance_type,
            "Latitude": location.latitude,
            "Longitude": location.longitude,
            "PunchesLocationId": location.punches_location_id,
        });

        let punch_resp_text = session
            .client
            .post("https://pt.mayohr.com/api/checkin/punch/locate")
            .json(&body)
            .send()
            .await?
            .text()
            .await?;

        let punch_resp: PunchResponse = serde_json::from_str(&punch_resp_text).map_err(|e| {
            HrError::PunchFailed(format!(
                "failed to parse response: {e}, body: {punch_resp_text}"
            ))
        })?;

        let status_code = punch_resp
            .meta
            .as_ref()
            .and_then(|m| m.http_status_code.as_deref())
            .unwrap_or("");

        if status_code != "200" {
            return Err(HrError::PunchFailed(format!(
                "unexpected status code: {}, body: {}",
                status_code, punch_resp_text
            )));
        }

        let punch_date_str = punch_resp
            .data
            .as_ref()
            .and_then(|d| d.punch_date.as_deref())
            .ok_or_else(|| HrError::PunchFailed("no punchDate in response".into()))?;

        let punch_dt = parse_datetime(punch_date_str)
            .ok_or_else(|| HrError::ParseError(format!("bad punchDate: {punch_date_str}")))?;

        let time_str = punch_dt.format("%H:%M:%S").to_string();

        Ok(PunchResult {
            punch_type,
            time: time_str,
        })
    }

    async fn logout(&self, session: &Session) -> Result<(), HrError> {
        // Non-fatal: fire-and-forget.
        let _ = session
            .client
            .get("https://auth.mayohr.com/api/accountapi/Logout")
            .send()
            .await;
        Ok(())
    }
}
