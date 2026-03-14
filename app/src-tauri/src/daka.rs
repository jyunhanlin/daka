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

        // Always logout, even on error (matches existing CLI behavior)
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
