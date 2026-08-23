use std::collections::HashMap;

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use uuid::Uuid;

use crate::{database::Database, error::AppError};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarItem {
    pub schedule_id: String,
    pub post_id: String,
    pub post_version_id: String,
    pub client_id: String,
    pub client_name: String,
    pub campaign_id: Option<String>,
    pub campaign_name: Option<String>,
    pub title: String,
    pub platform: String,
    pub content_type: String,
    pub status: String,
    pub scheduled_for: String,
    pub timezone: String,
    pub caption: String,
}

pub fn list_calendar_items(
    database: &Database,
    start: &str,
    end: &str,
    client_id: Option<String>,
    platform: Option<String>,
    status: Option<String>,
) -> Result<Vec<CalendarItem>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut statement=connection.prepare("SELECT s.id,p.id,pv.id,p.client_id,c.name,p.campaign_id,ca.name,COALESCE(p.title,''),pv.platform_id,p.content_type,p.status,s.scheduled_for,s.timezone,COALESCE(pv.caption,pv.description,'') FROM schedules s JOIN post_versions pv ON pv.id=s.post_version_id JOIN posts p ON p.id=pv.post_id JOIN clients c ON c.id=p.client_id LEFT JOIN campaigns ca ON ca.id=p.campaign_id WHERE s.status NOT IN ('cancelled') AND s.scheduled_for>=?1 AND s.scheduled_for<?2 AND (?3 IS NULL OR p.client_id=?3) AND (?4 IS NULL OR ?4='all' OR pv.platform_id=?4) AND (?5 IS NULL OR ?5='all' OR p.status=?5) ORDER BY s.scheduled_for")?;
    let rows = statement.query_map(params![start, end, client_id, platform, status], |row| {
        Ok(CalendarItem {
            schedule_id: row.get(0)?,
            post_id: row.get(1)?,
            post_version_id: row.get(2)?,
            client_id: row.get(3)?,
            client_name: row.get(4)?,
            campaign_id: row.get(5)?,
            campaign_name: row.get(6)?,
            title: row.get(7)?,
            platform: row.get(8)?,
            content_type: row.get(9)?,
            status: row.get(10)?,
            scheduled_for: row.get(11)?,
            timezone: row.get(12)?,
            caption: row.get(13)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn list_schedulable_posts(
    database: &Database,
    client_id: Option<String>,
) -> Result<Vec<crate::content_studio::PostSummary>, AppError> {
    crate::content_studio::list_posts(database, client_id, Some("approved".into()), None)
}

pub fn schedule_post(
    database: &Database,
    post_id: &str,
    scheduled_for: &str,
    timezone: &str,
    account_ids: HashMap<String, String>,
) -> Result<Vec<String>, AppError> {
    if scheduled_for.len() < 16 {
        return Err(AppError::Validation("Choose a valid date and time".into()));
    }
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let tx = connection.transaction()?;
    let client_id: Option<String> = tx
        .query_row(
            "SELECT client_id FROM posts WHERE id=?1 AND status='approved' AND deleted_at IS NULL",
            [post_id],
            |row| row.get(0),
        )
        .optional()?;
    let client_id = client_id
        .ok_or_else(|| AppError::Validation("Only human-approved posts can be scheduled".into()))?;
    let versions = {
        let mut stmt = tx.prepare(
            "SELECT id,platform_id FROM post_versions WHERE post_id=?1 AND version_number=1",
        )?;
        let rows = stmt
            .query_map([post_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    if versions.is_empty() {
        return Err(AppError::Validation("Post has no platform versions".into()));
    }
    let mut ids = Vec::new();
    for (version_id, platform) in versions {
        let account_id = account_ids.get(&platform).ok_or_else(|| {
            AppError::Validation(format!(
                "Select a connected {platform} account before scheduling"
            ))
        })?;
        let valid_account: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM social_accounts WHERE id=?1 AND client_id=?2 AND platform_id=?3 AND connection_status IN('connected','mock'))",
            params![account_id, client_id, platform],
            |row| row.get(0),
        )?;
        if !valid_account {
            return Err(AppError::Validation(format!(
                "The selected {platform} account is disconnected or belongs to another client"
            )));
        }
        tx.execute("DELETE FROM schedules WHERE post_version_id=?1 AND social_account_id=?2 AND scheduled_for=?3 AND status='cancelled'",params![version_id,account_id,scheduled_for])?;
        let schedule_id = Uuid::new_v4().to_string();
        let key = format!("{post_id}:{version_id}:{scheduled_for}");
        tx.execute("INSERT INTO schedules(id,post_version_id,social_account_id,scheduled_for,timezone,status,idempotency_key,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,'pending',?6,?7,?7)",params![schedule_id,version_id,account_id,scheduled_for,timezone,key,now])?;
        ids.push(schedule_id);
    }
    tx.execute("UPDATE posts SET status='scheduled',proposed_publish_at=?2,timezone=?3,updated_at=?4 WHERE id=?1",params![post_id,scheduled_for,timezone,now])?;
    tx.execute("INSERT INTO activity_logs(id,client_id,entity_type,entity_id,action,summary)VALUES(?1,?2,'post',?3,'scheduled','Approved post scheduled for explicitly selected accounts')",params![Uuid::new_v4().to_string(),client_id,post_id])?;
    tx.commit()?;
    drop(connection);
    crate::automation::add_notification(
        database,
        "post_scheduled",
        "Post scheduled",
        &format!("Approved post scheduled for {scheduled_for}"),
        "post",
        post_id,
    )?;
    Ok(ids)
}

pub fn reschedule_post(
    database: &Database,
    post_id: &str,
    scheduled_for: &str,
    timezone: &str,
) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    let connection = database.connection.lock().expect("database lock poisoned");
    let changed=connection.execute("UPDATE schedules SET scheduled_for=?2,timezone=?3,idempotency_key=post_version_id||':'||?2,updated_at=?4 WHERE post_version_id IN(SELECT id FROM post_versions WHERE post_id=?1) AND status IN('pending','failed','paused')",params![post_id,scheduled_for,timezone,now])?;
    if changed == 0 {
        return Err(AppError::Validation("No editable schedules found".into()));
    }
    connection.execute(
        "UPDATE posts SET proposed_publish_at=?2,timezone=?3,updated_at=?4 WHERE id=?1",
        params![post_id, scheduled_for, timezone, now],
    )?;
    Ok(())
}
pub fn unschedule_post(database: &Database, post_id: &str) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let tx = connection.transaction()?;
    let changed=tx.execute("UPDATE schedules SET status='cancelled',updated_at=?2 WHERE post_version_id IN(SELECT id FROM post_versions WHERE post_id=?1) AND status IN('pending','failed','paused')",params![post_id,now])?;
    if changed == 0 {
        return Err(AppError::Validation("No editable schedules found".into()));
    }
    tx.execute("UPDATE posts SET status='approved',updated_at=?2 WHERE id=?1 AND status IN('scheduled','failed','paused')",params![post_id,now])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{approvals, clients, content_studio, database::Database};
    use rusqlite::Connection;
    use std::sync::Mutex;
    #[test]
    fn only_approved_posts_can_be_scheduled_and_rescheduled() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        let db = Database {
            connection: Mutex::new(connection),
            app_data_dir: std::env::temp_dir(),
        };
        let client = clients::create_client(&db, clients::tests::input()).unwrap();
        let id = content_studio::save_post(&db, None, content_studio::tests::input(client.clone()))
            .unwrap();
        assert!(schedule_post(
            &db,
            &id,
            "2026-08-22T10:00:00",
            "Asia/Kolkata",
            std::collections::HashMap::new()
        )
        .is_err());
        content_studio::submit_post_for_review(&db, &id).unwrap();
        approvals::approve_post(&db, &id, "").unwrap();
        assert!(schedule_post(
            &db,
            &id,
            "2026-08-22T10:00:00",
            "Asia/Kolkata",
            std::collections::HashMap::new()
        )
        .is_err());
        let account = crate::social_accounts::connect_mock_account(
            &db,
            &client,
            "instagram",
            "Selected test account",
        )
        .unwrap();
        assert_eq!(
            schedule_post(
                &db,
                &id,
                "2026-08-22T10:00:00",
                "Asia/Kolkata",
                std::collections::HashMap::from([("instagram".into(), account)])
            )
            .unwrap()
            .len(),
            1
        );
        assert_eq!(
            list_calendar_items(&db, "2026-08-01", "2026-09-01", None, None, None)
                .unwrap()
                .len(),
            1
        );
        reschedule_post(&db, &id, "2026-08-23T11:00:00", "Asia/Kolkata").unwrap();
        unschedule_post(&db, &id).unwrap();
    }
}
