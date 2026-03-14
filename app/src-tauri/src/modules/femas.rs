use async_trait::async_trait;
use chrono::{Datelike, NaiveDate, NaiveDateTime, NaiveTime, Timelike};
use scraper::{Html, Selector};
use serde::Deserialize;
use std::collections::HashMap;

use super::{HrError, HrModule, PunchResult, PunchType, Session};

pub struct Femas {
    domain: String,
}

impl Femas {
    pub fn new(domain: impl Into<String>) -> Self {
        Femas {
            domain: domain.into(),
        }
    }

    fn base_url(&self) -> String {
        format!("https://femascloud.com/{}", self.domain)
    }
}

// ── JSON shapes ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct HolidayEntry {
    start: String,
}

#[derive(Deserialize)]
struct PersonalEvent {
    #[serde(rename = "startDateTime")]
    start_date_time: String,
    #[serde(rename = "endDateTime")]
    end_date_time: String,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Return the last day of the month for the given date.
///
/// Strategy: advance to the 1st of the next month, then subtract one day.
fn last_day_of_month(date: NaiveDate) -> NaiveDate {
    let (year, month) = if date.month() == 12 {
        (date.year() + 1, 1u32)
    } else {
        (date.year(), date.month() + 1)
    };
    NaiveDate::from_ymd_opt(year, month, 1)
        .expect("valid next-month date")
        .pred_opt()
        .expect("valid previous day")
}

/// Parse datetime strings in `%Y-%m-%dT%H:%M:%S` or with fractional seconds.
fn parse_datetime(s: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S"))
        .ok()
}

/// Return `true` when a personal event indicates the punch should be skipped.
///
/// Rules (matching the JS checkPersonalEvents logic, minus the 60-min buffer):
/// - All-day event (≥9 hours): always skip.
/// - Punch time falls within the event's [start, end] window: skip.
fn event_covers_punch(
    events: &[PersonalEvent],
    date: NaiveDate,
    punch_time: NaiveTime,
) -> bool {
    for event in events {
        let start_dt = match parse_datetime(&event.start_date_time) {
            Some(dt) => dt,
            None => continue,
        };
        let end_dt = match parse_datetime(&event.end_date_time) {
            Some(dt) => dt,
            None => continue,
        };

        // Only consider events that touch today.
        if date < start_dt.date() || date > end_dt.date() {
            continue;
        }

        // Narrow to the effective window on `date`.
        let day_start = if start_dt.date() == date {
            start_dt.time()
        } else {
            NaiveTime::from_hms_opt(0, 0, 0).unwrap()
        };
        let day_end = if end_dt.date() == date {
            end_dt.time()
        } else {
            NaiveTime::from_hms_opt(23, 59, 59).unwrap()
        };

        // All-day: duration ≥ 9 hours → skip.
        let duration_hours = (day_end.hour() as i32) - (day_start.hour() as i32);
        if duration_hours >= 9 {
            return true;
        }

        // Punch time inside the event window → skip.
        if punch_time >= day_start && punch_time <= day_end {
            return true;
        }
    }

    false
}

// ── HrModule impl ─────────────────────────────────────────────────────────────

#[async_trait]
impl HrModule for Femas {
    /// Log in to Femas.
    ///
    /// Flow:
    /// 1. GET the domain home page — the server sets a session cookie via
    ///    `Set-Cookie`; the reqwest cookie store captures it automatically.
    /// 2. POST credentials to the login endpoint.
    /// 3. Parse the response HTML for `#ClockRecordUserId` and
    ///    `#AttRecordUserId` hidden inputs; store both in `Session.extra`.
    async fn login(&self, username: &str, password: &str) -> Result<Session, HrError> {
        let client = reqwest::Client::builder()
            .cookie_store(true)
            .build()
            .map_err(HrError::NetworkError)?;

        // Step 1 — GET home page to acquire the session cookie.
        client
            .get(format!("{}/", self.base_url()))
            .send()
            .await?;

        // Step 2 — POST login credentials.
        let login_url = format!("{}/Accounts/login", self.base_url());
        let form = [
            ("data[Account][username]", username),
            ("data[Account][passwd]", password),
            ("data[remember]", "0"),
        ];

        let html = client
            .post(&login_url)
            .form(&form)
            .send()
            .await?
            .text()
            .await?;

        // Step 3 — Parse hidden inputs.  `Html` is not `Send`, so we finish
        // all parsing before any subsequent `.await`.
        let (clock_record_user_id, att_record_user_id) = {
            let document = Html::parse_document(&html);

            let sel_clock = Selector::parse("#ClockRecordUserId")
                .map_err(|e| HrError::ParseError(format!("selector error: {:?}", e)))?;
            let sel_att = Selector::parse("#AttRecordUserId")
                .map_err(|e| HrError::ParseError(format!("selector error: {:?}", e)))?;

            let clock_id = document
                .select(&sel_clock)
                .next()
                .and_then(|el| el.value().attr("value"))
                .ok_or_else(|| HrError::LoginFailed("ClockRecordUserId not found in page".into()))?
                .to_string();

            let att_id = document
                .select(&sel_att)
                .next()
                .and_then(|el| el.value().attr("value"))
                .ok_or_else(|| HrError::LoginFailed("AttRecordUserId not found in page".into()))?
                .to_string();

            (clock_id, att_id)
        };

        let mut extra = HashMap::new();
        extra.insert("ClockRecordUserId".to_string(), clock_record_user_id);
        extra.insert("AttRecordUserId".to_string(), att_record_user_id);

        Ok(Session { client, extra })
    }

    /// Return `true` when `date` is a public holiday in the Femas calendar.
    async fn is_holiday(&self, session: &Session, date: NaiveDate) -> Result<bool, HrError> {
        let first = NaiveDate::from_ymd_opt(date.year(), date.month(), 1)
            .expect("valid first-of-month date");
        let last = last_day_of_month(date);

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);

        let url = format!(
            "{}/Holidays/get_holidays?start={}&end={}&_={}",
            self.base_url(),
            first.format("%Y-%m-%d"),
            last.format("%Y-%m-%d"),
            timestamp,
        );

        let holidays: Vec<HolidayEntry> = session
            .client
            .get(&url)
            .send()
            .await?
            .json()
            .await
            .map_err(|e| HrError::CalendarFailed(format!("failed to parse holidays JSON: {e}")))?;

        let today_str = date.format("%Y-%m-%d").to_string();
        Ok(holidays.iter().any(|h| h.start == today_str))
    }

    /// Return `true` when a personal event means we should skip punching.
    async fn has_personal_event(
        &self,
        session: &Session,
        date: NaiveDate,
        _punch_type: PunchType,
        punch_time: NaiveTime,
    ) -> Result<bool, HrError> {
        let first = NaiveDate::from_ymd_opt(date.year(), date.month(), 1)
            .expect("valid first-of-month date");
        let last = last_day_of_month(date);

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);

        let url = format!(
            "{}/Holidays/get_events?start={}&end={}&_={}",
            self.base_url(),
            first.format("%Y-%m-%d"),
            last.format("%Y-%m-%d"),
            timestamp,
        );

        let events: Vec<PersonalEvent> = session
            .client
            .get(&url)
            .send()
            .await?
            .json()
            .await
            .map_err(|e| HrError::CalendarFailed(format!("failed to parse events JSON: {e}")))?;

        Ok(event_covers_punch(&events, date, punch_time))
    }

    /// Submit a punch-in or punch-out and return the recorded time.
    ///
    /// The response is HTML; `.textBlue` elements contain the recorded times:
    /// index 0 = punch-in time, index 1 = punch-out time.
    async fn punch(
        &self,
        session: &Session,
        punch_type: PunchType,
    ) -> Result<PunchResult, HrError> {
        let clock_record_user_id = session
            .extra
            .get("ClockRecordUserId")
            .ok_or_else(|| HrError::PunchFailed("ClockRecordUserId missing from session".into()))?
            .as_str();

        let att_record_user_id = session
            .extra
            .get("AttRecordUserId")
            .ok_or_else(|| HrError::PunchFailed("AttRecordUserId missing from session".into()))?
            .as_str();

        let clock_type = match punch_type {
            PunchType::In => "S",
            PunchType::Out => "E",
        };

        let url = format!("{}/users/clock_listing", self.base_url());
        let form = [
            ("_method", "POST"),
            ("data[ClockRecord][user_id]", clock_record_user_id),
            ("data[AttRecord][user_id]", att_record_user_id),
            ("data[ClockRecord][shift_id]", "2"),
            ("data[ClockRecord][period]", "1"),
            ("data[ClockRecord][clock_type]", clock_type),
            ("data[ClockRecord][latitude]", ""),
            ("data[ClockRecord][longitude]", ""),
        ];

        let html = session
            .client
            .post(&url)
            .header("x-requested-with", "XMLHttpRequest")
            .form(&form)
            .send()
            .await?
            .text()
            .await?;

        // Parse `.textBlue` elements; `Html` is not `Send` — finish before any await.
        let daka_time = {
            let document = Html::parse_document(&html);
            let selector = Selector::parse(".textBlue")
                .map_err(|e| HrError::ParseError(format!("selector error: {:?}", e)))?;

            let elements: Vec<String> = document
                .select(&selector)
                .map(|el| el.text().collect::<String>().trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            // Index 0 = punch-in time, index 1 = punch-out time.
            let idx = match punch_type {
                PunchType::In => 0,
                PunchType::Out => 1,
            };

            elements
                .get(idx)
                .cloned()
                .ok_or_else(|| HrError::PunchFailed("no time found in punch response".into()))?
        };

        Ok(PunchResult {
            punch_type,
            time: daka_time,
        })
    }

    /// Log out by hitting the logout endpoint; errors are non-fatal.
    async fn logout(&self, session: &Session) -> Result<(), HrError> {
        let _ = session
            .client
            .get(format!("{}/accounts/logout", self.base_url()))
            .send()
            .await;
        Ok(())
    }
}
