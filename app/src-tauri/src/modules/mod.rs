pub mod femas;
pub mod mayo;

use async_trait::async_trait;
use chrono::NaiveDate;
use std::collections::HashMap;
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
    pub extra: HashMap<String, String>,
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
    async fn punch(&self, session: &Session, punch_type: PunchType)
        -> Result<PunchResult, HrError>;
    async fn logout(&self, session: &Session) -> Result<(), HrError>;
}
