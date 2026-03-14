use chrono::{Local, NaiveTime, TimeDelta};
use log::info;
use rand::Rng;

use crate::config::AppConfig;
use crate::daka::{DakaOutcome, DakaService};
use crate::modules::PunchType;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/// Calculate a random delay in minutes within [min_mins, max_mins].
/// If min_mins == max_mins, returns that value deterministically.
pub fn random_delay_mins(min_mins: u32, max_mins: u32) -> u32 {
    if min_mins >= max_mins {
        return min_mins;
    }
    rand::thread_rng().gen_range(min_mins..=max_mins)
}

/// Calculate the actual punch time = base_time + delay_mins.
pub fn calculate_punch_time(base_time: NaiveTime, delay_mins: u32) -> NaiveTime {
    base_time + TimeDelta::minutes(delay_mins as i64)
}

/// Determine if a scheduled time should still execute relative to `now`.
pub fn should_execute(scheduled_time: NaiveTime, now: NaiveTime, tolerance_mins: u32) -> ShouldExecute {
    if now < scheduled_time {
        return ShouldExecute::Wait;
    }
    let deadline = scheduled_time + TimeDelta::minutes(tolerance_mins as i64);
    if now <= deadline {
        ShouldExecute::ExecuteNow
    } else {
        ShouldExecute::Skip
    }
}

#[derive(Debug, PartialEq)]
pub enum ShouldExecute {
    /// now < scheduled_time — sleep until then
    Wait,
    /// past scheduled_time but within tolerance
    ExecuteNow,
    /// past tolerance window
    Skip,
}

// ---------------------------------------------------------------------------
// DailySchedule
// ---------------------------------------------------------------------------

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
        let base_in = NaiveTime::parse_from_str(&config.schedule.punch_in, "%H:%M")
            .expect("Invalid punch_in time format in config");
        let base_out = NaiveTime::parse_from_str(&config.schedule.punch_out, "%H:%M")
            .expect("Invalid punch_out time format in config");

        // Punch-in: random delay in [0, delay_start_mins]
        let in_delay = random_delay_mins(0, config.schedule.delay_start_mins);
        // Punch-out: random delay in [delay_start_mins, delay_end_mins]
        let out_delay = random_delay_mins(
            config.schedule.delay_start_mins,
            config.schedule.delay_end_mins,
        );

        let punch_in_time = calculate_punch_time(base_in, in_delay);
        let punch_out_time = calculate_punch_time(base_out, out_delay);

        info!(
            "Today's schedule — punch-in: {} (base {} + {}min), punch-out: {} (base {} + {}min)",
            punch_in_time, base_in, in_delay, punch_out_time, base_out, out_delay
        );

        Self { punch_in_time, punch_out_time }
    }
}

// ---------------------------------------------------------------------------
// Scheduler loop
// ---------------------------------------------------------------------------

pub async fn run_scheduler(
    daka_service: Arc<DakaService>,
    config: AppConfig,
    tx: mpsc::UnboundedSender<ScheduleEvent>,
) {
    loop {
        let schedule = DailySchedule::new(&config);
        let tolerance = config.schedule.late_tolerance_mins;

        // --- Punch-in ---
        handle_punch(
            &daka_service,
            &tx,
            PunchType::In,
            schedule.punch_in_time,
            tolerance,
        )
        .await;

        // --- Punch-out ---
        handle_punch(
            &daka_service,
            &tx,
            PunchType::Out,
            schedule.punch_out_time,
            tolerance,
        )
        .await;

        // --- Sleep until midnight + 30 s buffer ---
        let now = Local::now().naive_local().time();
        let midnight = NaiveTime::from_hms_opt(0, 0, 0).unwrap();
        // Seconds remaining until next midnight
        let secs_until_midnight = if now < midnight {
            // should not happen but guard anyway
            0u64
        } else {
            let elapsed = (now - midnight).num_seconds() as u64;
            let day_secs: u64 = 24 * 60 * 60;
            day_secs.saturating_sub(elapsed)
        };
        let buffer_secs = 30u64;
        info!(
            "Daily loop done. Sleeping {}s until next day.",
            secs_until_midnight + buffer_secs
        );
        sleep(Duration::from_secs(secs_until_midnight + buffer_secs)).await;
    }
}

async fn handle_punch(
    daka_service: &Arc<DakaService>,
    tx: &mpsc::UnboundedSender<ScheduleEvent>,
    punch_type: PunchType,
    scheduled_time: NaiveTime,
    tolerance_mins: u32,
) {
    loop {
        let now = Local::now().time();
        match should_execute(scheduled_time, now, tolerance_mins) {
            ShouldExecute::Wait => {
                let wait_secs = (scheduled_time - now).num_seconds().max(1) as u64;
                info!(
                    "{} punch scheduled at {}; sleeping {}s",
                    punch_type.label(),
                    scheduled_time,
                    wait_secs
                );
                sleep(Duration::from_secs(wait_secs)).await;
            }
            ShouldExecute::ExecuteNow => {
                info!(
                    "Executing {} punch (scheduled {})",
                    punch_type.label(),
                    scheduled_time
                );
                let outcome = daka_service.execute(punch_type, scheduled_time).await;
                let _ = tx.send(ScheduleEvent { punch_type, outcome });
                break;
            }
            ShouldExecute::Skip => {
                info!(
                    "Skipping {} punch — past tolerance window (scheduled {})",
                    punch_type.label(),
                    scheduled_time
                );
                break;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveTime;

    fn t(h: u32, m: u32) -> NaiveTime {
        NaiveTime::from_hms_opt(h, m, 0).unwrap()
    }

    #[test]
    fn test_random_delay_within_range() {
        let min = 0u32;
        let max = 15u32;
        for _ in 0..100 {
            let delay = random_delay_mins(min, max);
            assert!(
                delay >= min && delay <= max,
                "delay {} out of range [{}, {}]",
                delay,
                min,
                max
            );
        }
    }

    #[test]
    fn test_random_delay_equal_min_max() {
        let delay = random_delay_mins(7, 7);
        assert_eq!(delay, 7);
    }

    #[test]
    fn test_calculate_punch_time() {
        let result = calculate_punch_time(t(9, 0), 5);
        assert_eq!(result, t(9, 5));
    }

    #[test]
    fn test_should_execute_wait() {
        // now (08:50) < scheduled (09:00) → Wait
        assert_eq!(should_execute(t(9, 0), t(8, 50), 30), ShouldExecute::Wait);
    }

    #[test]
    fn test_should_execute_now_within_tolerance() {
        // now (09:15) > scheduled (09:00), within 30-min tolerance → ExecuteNow
        assert_eq!(
            should_execute(t(9, 0), t(9, 15), 30),
            ShouldExecute::ExecuteNow
        );
    }

    #[test]
    fn test_should_execute_skip_past_tolerance() {
        // now (09:45) > scheduled (09:00) + 30 min tolerance → Skip
        assert_eq!(
            should_execute(t(9, 0), t(9, 45), 30),
            ShouldExecute::Skip
        );
    }

    #[test]
    fn test_should_execute_exact_time() {
        // now == scheduled → ExecuteNow
        assert_eq!(
            should_execute(t(9, 0), t(9, 0), 30),
            ShouldExecute::ExecuteNow
        );
    }
}
