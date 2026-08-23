use crate::{
    database::Database,
    error::AppError,
    platforms::{
        mock::MockPlatformAdapter, official_adapter, PlatformAdapter, PlatformKind, PublishRequest,
        PublishResult,
    },
};
use chrono::{Local, Utc};
use rusqlite::params;
use serde::Serialize;
use serde_json::json;
use std::{process::Command, thread, time::Duration};
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    pub id: String,
    pub schedule_id: String,
    pub post_id: String,
    pub client_id: String,
    pub client_name: String,
    pub platform: String,
    pub title: String,
    pub caption: String,
    pub scheduled_for: String,
    pub timezone: String,
    pub status: String,
    pub attempts: i64,
    pub max_retries: i64,
    pub last_error: Option<String>,
    pub external_post_id: Option<String>,
    pub updated_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationRecord {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub body: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub is_read: bool,
    pub created_at: String,
}

fn parse_string_list(value: &str) -> Vec<String> {
    serde_json::from_str(value).unwrap_or_default()
}

fn compose_caption(hook: &str, caption: &str, cta: &str, hashtags: &[String]) -> String {
    let mut sections = [hook, caption, cta]
        .into_iter()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    if !hashtags.is_empty() {
        sections.push(
            hashtags
                .iter()
                .map(|tag| {
                    if tag.starts_with('#') {
                        tag.clone()
                    } else {
                        format!("#{tag}")
                    }
                })
                .collect::<Vec<_>>()
                .join(" "),
        );
    }
    sections.join("\n\n")
}

fn publish_and_verify(
    adapter: &dyn PlatformAdapter,
    request: &PublishRequest,
) -> Result<(PublishResult, Option<String>), String> {
    let published = adapter.publish_post(request)?;
    let Some(external_id) = published.external_post_id.as_deref() else {
        return Ok((published, None));
    };
    let mut last_error = String::new();
    for attempt in 0..3 {
        match adapter.get_publish_status(external_id) {
            Ok(status) if !status.trim().is_empty() && !status.eq_ignore_ascii_case("unknown") => {
                let lower = status.to_ascii_lowercase();
                if ["failed", "error", "rejected"]
                    .iter()
                    .any(|value| lower.contains(value))
                {
                    return Ok((published, Some(format!("platform reported {status}"))));
                }
                return Ok((published, Some(status)));
            }
            Ok(status) => last_error = format!("platform returned status {status}"),
            Err(error) => last_error = error,
        }
        if attempt < 2 {
            thread::sleep(Duration::from_secs(2));
        }
    }
    // The platform already accepted this post. Keep it published to prevent an automatic
    // retry from creating a duplicate, and surface that independent verification is pending.
    Ok((published, Some(format!("pending: {last_error}"))))
}

fn platform_kind(platform: &str) -> Result<PlatformKind, AppError> {
    match platform {
        "instagram" => Ok(PlatformKind::Instagram),
        "facebook" => Ok(PlatformKind::Facebook),
        "twitter" => Ok(PlatformKind::Twitter),
        "youtube" => Ok(PlatformKind::YouTube),
        _ => Err(AppError::Validation(format!("No adapter for {platform}"))),
    }
}
pub(crate) fn add_notification(
    database: &Database,
    kind: &str,
    title: &str,
    body: &str,
    entity_type: &str,
    entity_id: &str,
) -> Result<(), AppError> {
    let enabled = {
        let c = database.connection.lock().expect("database lock poisoned");
        c.query_row("SELECT COALESCE((SELECT value FROM settings WHERE key='notifications.enabled'),'true')",[],|r|r.get::<_,String>(0))?=="true"
    };
    let connection = database.connection.lock().expect("database lock poisoned");
    connection.execute("INSERT INTO notifications(id,kind,title,body,entity_type,entity_id,created_at)VALUES(?1,?2,?3,?4,?5,?6,?7)",params![Uuid::new_v4().to_string(),kind,title,body,entity_type,entity_id,Utc::now().to_rfc3339()])?;
    drop(connection);
    if enabled && cfg!(target_os = "macos") && !cfg!(test) {
        let safe_title = title.replace('"', "'");
        let safe_body = body.replace('"', "'");
        let _ = Command::new("osascript")
            .args([
                "-e",
                &format!("display notification \"{safe_body}\" with title \"{safe_title}\""),
            ])
            .status();
    }
    Ok(())
}

pub fn enqueue_due(database: &Database) -> Result<usize, AppError> {
    let now_local = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let now = Utc::now().to_rfc3339();
    let connection = database.connection.lock().expect("database lock poisoned");
    let changed=connection.execute("INSERT OR IGNORE INTO publishing_queue(id,schedule_id,status,next_attempt_at,created_at,updated_at) SELECT lower(hex(randomblob(16))),s.id,'queued',?2,?2,?2 FROM schedules s JOIN post_versions pv ON pv.id=s.post_version_id JOIN posts p ON p.id=pv.post_id WHERE ((s.status='pending' AND s.scheduled_for<=?1) OR (s.status='failed' AND s.next_retry_at<=?2)) AND p.status IN('scheduled','failed')",params![now_local,now])?;
    connection.execute("UPDATE schedules SET status='queued',updated_at=?2 WHERE id IN(SELECT schedule_id FROM publishing_queue WHERE status IN('queued','retrying')) AND status IN('pending','failed')",params![now_local,now])?;
    Ok(changed)
}

pub fn process_queue(database: &Database, limit: usize) -> Result<usize, AppError> {
    let now = Utc::now().to_rfc3339();
    let jobs = {
        let connection = database.connection.lock().expect("database lock poisoned");
        let mut stmt=connection.prepare("SELECT q.id,q.schedule_id,p.id,p.client_id,pv.platform_id,sa.id,sa.connection_status,sa.external_account_id,sa.auth_storage_key,sa.settings,COALESCE(pv.hook,''),COALESCE(pv.caption,''),COALESCE(pv.cta,''),pv.hashtags,COALESCE(pv.title,p.title,''),COALESCE(pv.description,''),pv.keywords,pv.platform_metadata,COALESCE((SELECT json_group_array(m.relative_path) FROM post_media pm JOIN media m ON m.id=pm.media_id WHERE pm.post_version_id=pv.id AND m.deleted_at IS NULL),'[]'),q.attempts,s.max_retries FROM publishing_queue q JOIN schedules s ON s.id=q.schedule_id JOIN post_versions pv ON pv.id=s.post_version_id JOIN posts p ON p.id=pv.post_id JOIN social_accounts sa ON sa.id=s.social_account_id WHERE q.status IN('queued','retrying') AND (q.next_attempt_at IS NULL OR q.next_attempt_at<=?1) AND p.status IN('scheduled','failed') ORDER BY s.scheduled_for LIMIT ?2")?;
        let rows = stmt.query_map(params![now, limit as i64], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, Option<String>>(7)?,
                r.get::<_, Option<String>>(8)?,
                r.get::<_, String>(9)?,
                r.get::<_, String>(10)?,
                r.get::<_, String>(11)?,
                r.get::<_, String>(12)?,
                r.get::<_, String>(13)?,
                r.get::<_, String>(14)?,
                r.get::<_, String>(15)?,
                r.get::<_, String>(16)?,
                r.get::<_, String>(17)?,
                r.get::<_, String>(18)?,
                r.get::<_, i64>(19)?,
                r.get::<_, i64>(20)?,
            ))
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    let mut processed = 0;
    for (
        queue_id,
        schedule_id,
        post_id,
        client_id,
        platform,
        account_id,
        connection_status,
        external_account_id,
        auth_storage_key,
        settings,
        hook,
        caption,
        cta,
        hashtags_json,
        title,
        description,
        keywords_json,
        platform_metadata_json,
        media_json,
        attempts,
        max_retries,
    ) in jobs
    {
        processed += 1;
        let attempt = attempts + 1;
        {
            let connection = database.connection.lock().expect("database lock poisoned");
            let claimed=connection.execute("UPDATE publishing_queue SET status='publishing',attempts=?2,locked_at=?3,updated_at=?3 WHERE id=?1 AND status IN('queued','retrying')",params![queue_id,attempt,now])?;
            if claimed == 0 {
                continue;
            }
            connection.execute("UPDATE schedules SET status='processing',locked_at=?2,last_attempt_at=?2,updated_at=?2 WHERE id=?1",params![schedule_id,now])?;
            connection.execute(
                "UPDATE posts SET status='publishing',updated_at=?2 WHERE id=?1",
                params![post_id, now],
            )?;
            connection.execute("INSERT INTO publishing_logs(id,schedule_id,attempt_number,adapter_key,started_at,status,request_summary)VALUES(?1,?2,?3,?4,?5,'started',?6)",params![Uuid::new_v4().to_string(),schedule_id,attempt,platform,now,json!({"post_id":post_id,"mock":connection_status=="mock"}).to_string()])?;
        }
        add_notification(
            database,
            "publishing_started",
            "Post is publishing",
            &format!("Publishing to {platform} now"),
            "post",
            &post_id,
        )?;
        let configured_failure: bool = serde_json::from_str::<serde_json::Value>(&settings)
            .ok()
            .and_then(|v| {
                v.get("fail_next")
                    .map(|x| x.as_bool().unwrap_or_else(|| x.as_i64() == Some(1)))
            })
            .unwrap_or(false);
        let hashtags = parse_string_list(&hashtags_json);
        let keywords = parse_string_list(&keywords_json);
        let composed_caption = compose_caption(&hook, &caption, &cta, &hashtags);
        let composed_description = compose_caption("", &description, &cta, &hashtags);
        let media_paths = parse_string_list(&media_json)
            .into_iter()
            .map(|relative| {
                database
                    .app_data_dir
                    .join(relative)
                    .to_string_lossy()
                    .into_owned()
            })
            .collect::<Vec<_>>();
        let platform_metadata =
            serde_json::from_str(&platform_metadata_json).unwrap_or_else(|_| json!({}));
        let request = PublishRequest {
            post_id: post_id.clone(),
            account_id: account_id.clone(),
            title: Some(title),
            caption: Some(composed_caption),
            description: Some(composed_description),
            keywords,
            media_paths,
            platform_metadata,
        };
        let result = if !["mock", "connected"].contains(&connection_status.as_str()) {
            Err(format!("Account connection is {connection_status}"))
        } else if configured_failure {
            Err("Simulated publishing failure".into())
        } else if connection_status == "connected" {
            let external_account_id = external_account_id
                .ok_or_else(|| "Connected account is missing its platform account ID".to_string());
            let auth_storage_key = auth_storage_key.ok_or_else(|| {
                "Connected account is missing its Keychain token reference".to_string()
            });
            match (external_account_id, auth_storage_key) {
                (Ok(external_account_id), Ok(auth_storage_key)) => {
                    let token = crate::security::read_oauth_token(&auth_storage_key)
                        .map_err(|error| error.to_string());
                    match token {
                        Ok(token) => official_adapter(
                            &platform,
                            token,
                            external_account_id,
                            serde_json::from_str(&settings).unwrap_or_else(|_| json!({})),
                        )
                        .and_then(|adapter| publish_and_verify(adapter.as_ref(), &request)),
                        Err(error) => Err(error),
                    }
                }
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        } else {
            let adapter = MockPlatformAdapter::new(platform_kind(&platform)?);
            adapter
                .publish_post(&request)
                .map(|published| (published, Some("mock".into())))
                .map_err(|e| e.to_string())
        };
        let finish = Utc::now().to_rfc3339();
        let mut connection = database.connection.lock().expect("database lock poisoned");
        let tx = connection.transaction()?;
        if configured_failure {
            tx.execute("UPDATE social_accounts SET settings=json_set(settings,'$.fail_next',false),updated_at=?2 WHERE id=?1",params![account_id,finish])?;
        }
        match result {
            Ok((published, verification_status)) if published.succeeded => {
                let external = published
                    .external_post_id
                    .unwrap_or_else(|| format!("mock-{}", Uuid::new_v4()));
                tx.execute("UPDATE publishing_queue SET status='published',external_post_id=?2,last_error=NULL,locked_at=NULL,updated_at=?3 WHERE id=?1",params![queue_id,external,finish])?;
                tx.execute("UPDATE schedules SET status='completed',locked_at=NULL,updated_at=?2 WHERE id=?1",params![schedule_id,finish])?;
                let verified = connection_status == "mock"
                    || verification_status.as_deref().is_some_and(|status| {
                        !status.starts_with("pending:") && !status.starts_with("platform reported")
                    });
                tx.execute("UPDATE publishing_logs SET status='succeeded',finished_at=?2,external_post_id=?3,response_summary=?4 WHERE schedule_id=?1 AND attempt_number=?5",params![schedule_id,finish,external,json!({"message":published.message,"verification_status":verification_status,"verified":verified}).to_string(),attempt])?;
                let remaining:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM schedules s JOIN post_versions pv ON pv.id=s.post_version_id WHERE pv.post_id=?1 AND s.status!='completed' AND s.status!='cancelled')",[&post_id],|r|r.get(0))?;
                tx.execute(
                    "UPDATE posts SET status=?2,updated_at=?3 WHERE id=?1",
                    params![
                        post_id,
                        if remaining { "scheduled" } else { "published" },
                        finish
                    ],
                )?;
                tx.execute("INSERT INTO activity_logs(id,client_id,entity_type,entity_id,action,summary,metadata)VALUES(?1,?2,'post',?3,'published',?4,?5)",params![Uuid::new_v4().to_string(),client_id,post_id,format!("Published successfully to {platform}"),json!({"mode":connection_status,"external_post_id":external}).to_string()])?;
                tx.commit()?;
                drop(connection);
                add_notification(
                    database,
                    "publish_success",
                    "Post published",
                    &format!("Published successfully to {platform}"),
                    "post",
                    &post_id,
                )?;
            }
            _ => {
                let error = result
                    .err()
                    .unwrap_or_else(|| "Adapter returned failure".into());
                let retry = attempt < max_retries;
                let delay = 2_i64.pow(attempt.min(8) as u32) * 60;
                let next = (Utc::now() + chrono::Duration::seconds(delay)).to_rfc3339();
                tx.execute("UPDATE publishing_queue SET status=?2,last_error=?3,next_attempt_at=?4,locked_at=NULL,updated_at=?5 WHERE id=?1",params![queue_id,if retry{"retrying"}else{"failed"},error,next,finish])?;
                tx.execute("UPDATE schedules SET status='failed',retry_count=?2,next_retry_at=?3,locked_at=NULL,updated_at=?4 WHERE id=?1",params![schedule_id,attempt,next,finish])?;
                tx.execute(
                    "UPDATE posts SET status='failed',updated_at=?2 WHERE id=?1",
                    params![post_id, finish],
                )?;
                tx.execute("UPDATE publishing_logs SET status='failed',finished_at=?2,error_code='PUBLISH_FAILED',error_message=?3 WHERE schedule_id=?1 AND attempt_number=?4",params![schedule_id,finish,error,attempt])?;
                tx.commit()?;
                drop(connection);
                add_notification(
                    database,
                    "publish_failure",
                    "Publishing failed",
                    &format!("{platform}: {error}"),
                    "post",
                    &post_id,
                )?;
            }
        }
    }
    Ok(processed)
}
pub fn tick(database: &Database) -> Result<usize, AppError> {
    recover_stale_jobs(database)?;
    enqueue_due(database)?;
    process_queue(database, 20)
}

fn recover_stale_jobs(database: &Database) -> Result<(), AppError> {
    let cutoff = (Utc::now() - chrono::Duration::minutes(5)).to_rfc3339();
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let tx = connection.transaction()?;
    tx.execute("UPDATE publishing_queue SET status='retrying',locked_at=NULL,next_attempt_at=?2,last_error='Recovered after interrupted publishing',updated_at=?2 WHERE status='publishing' AND locked_at<?1",params![cutoff,now])?;
    tx.execute("UPDATE schedules SET status='failed',locked_at=NULL,next_retry_at=?2,updated_at=?2 WHERE status='processing' AND locked_at<?1",params![cutoff,now])?;
    tx.execute("UPDATE posts SET status='failed',updated_at=?2 WHERE id IN(SELECT pv.post_id FROM post_versions pv JOIN schedules s ON s.post_version_id=pv.id WHERE s.status='failed') AND status='publishing'",params![cutoff,now])?;
    tx.commit()?;
    Ok(())
}

pub fn start_worker(database_path: std::path::PathBuf) {
    thread::spawn(move || loop {
        if let Ok(database) = Database::open(&database_path) {
            let enabled = {
                let c = database.connection.lock().expect("database lock poisoned");
                c.query_row(
                    "SELECT value FROM settings WHERE key='scheduler.enabled'",
                    [],
                    |r| r.get::<_, String>(0),
                )
                .unwrap_or_else(|_| "true".into())
                    == "true"
            };
            if enabled {
                let _ = tick(&database);
            }
        }
        thread::sleep(Duration::from_secs(15));
    });
}

pub fn list_queue(database: &Database, status: Option<String>) -> Result<Vec<QueueItem>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT q.id,q.schedule_id,p.id,p.client_id,c.name,pv.platform_id,COALESCE(p.title,''),COALESCE(pv.caption,pv.description,''),s.scheduled_for,s.timezone,q.status,q.attempts,s.max_retries,q.last_error,q.external_post_id,q.updated_at FROM publishing_queue q JOIN schedules s ON s.id=q.schedule_id JOIN post_versions pv ON pv.id=s.post_version_id JOIN posts p ON p.id=pv.post_id JOIN clients c ON c.id=p.client_id WHERE (?1 IS NULL OR ?1='all' OR q.status=?1) ORDER BY s.scheduled_for DESC LIMIT 500")?;
    let rows = stmt.query_map([status], |r| {
        Ok(QueueItem {
            id: r.get(0)?,
            schedule_id: r.get(1)?,
            post_id: r.get(2)?,
            client_id: r.get(3)?,
            client_name: r.get(4)?,
            platform: r.get(5)?,
            title: r.get(6)?,
            caption: r.get(7)?,
            scheduled_for: r.get(8)?,
            timezone: r.get(9)?,
            status: r.get(10)?,
            attempts: r.get(11)?,
            max_retries: r.get(12)?,
            last_error: r.get(13)?,
            external_post_id: r.get(14)?,
            updated_at: r.get(15)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
pub fn retry_queue_item(database: &Database, queue_id: &str) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;
    let changed=transaction.execute("UPDATE publishing_queue SET status='retrying',next_attempt_at=?2,last_error=NULL,locked_at=NULL,updated_at=?2 WHERE id=?1 AND status IN ('failed','retrying')",params![queue_id,now])?;
    if changed == 0 {
        return Err(AppError::Validation(
            "Only failed or retrying queue items can be retried".into(),
        ));
    }
    transaction.execute("UPDATE schedules SET status='failed',next_retry_at=?2,locked_at=NULL,updated_at=?2 WHERE id=(SELECT schedule_id FROM publishing_queue WHERE id=?1)",params![queue_id,now])?;
    transaction.commit()?;
    Ok(())
}
pub fn cancel_queue_item(database: &Database, queue_id: &str) -> Result<(), AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let changed=connection.execute("UPDATE publishing_queue SET status='cancelled',updated_at=?2 WHERE id=?1 AND status IN('queued','retrying','failed')",params![queue_id,Utc::now().to_rfc3339()])?;
    if changed == 0 {
        return Err(AppError::Validation(
            "This queue item cannot be cancelled".into(),
        ));
    }
    Ok(())
}
pub fn publish_now(database: &Database, schedule_id: &str) -> Result<(), AppError> {
    let now = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let connection = database.connection.lock().expect("database lock poisoned");
    connection.execute("UPDATE schedules SET scheduled_for=?2,status='pending',next_retry_at=NULL,updated_at=?3 WHERE id=?1 AND status IN('pending','queued','failed')",params![schedule_id,now,Utc::now().to_rfc3339()])?;
    drop(connection);
    tick(database)?;
    Ok(())
}
pub fn list_notifications(database: &Database) -> Result<Vec<NotificationRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT id,kind,title,body,entity_type,entity_id,is_read,created_at FROM notifications ORDER BY created_at DESC LIMIT 100")?;
    let rows = stmt.query_map([], |r| {
        Ok(NotificationRecord {
            id: r.get(0)?,
            kind: r.get(1)?,
            title: r.get(2)?,
            body: r.get(3)?,
            entity_type: r.get(4)?,
            entity_id: r.get(5)?,
            is_read: r.get::<_, i64>(6)? == 1,
            created_at: r.get(7)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
pub fn mark_notification_read(database: &Database, id: &str) -> Result<(), AppError> {
    database
        .connection
        .lock()
        .expect("database lock poisoned")
        .execute("UPDATE notifications SET is_read=1 WHERE id=?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        approvals, calendar, clients, content_studio, database::Database, social_accounts,
    };
    use rusqlite::Connection;
    use std::sync::Mutex;

    #[test]
    fn publishing_copy_includes_hook_cta_and_normalised_hashtags() {
        let copy = compose_caption(
            "Start here",
            "Main caption",
            "Book today",
            &["LocalBusiness".into(), "#Surat".into()],
        );
        assert_eq!(
            copy,
            "Start here\n\nMain caption\n\nBook today\n\n#LocalBusiness #Surat"
        );
    }

    fn scheduled(fail: bool) -> (Database, String) {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        let database = Database {
            connection: Mutex::new(connection),
            app_data_dir: std::env::temp_dir(),
        };
        let client = clients::create_client(&database, clients::tests::input()).unwrap();
        let post = content_studio::save_post(
            &database,
            None,
            content_studio::tests::input(client.clone()),
        )
        .unwrap();
        content_studio::submit_post_for_review(&database, &post).unwrap();
        approvals::approve_post(&database, &post, "").unwrap();
        let past = (Local::now() - chrono::Duration::minutes(1))
            .format("%Y-%m-%dT%H:%M:%S")
            .to_string();
        let account = social_accounts::connect_mock_account(
            &database,
            &client,
            "instagram",
            "Selected automation account",
        )
        .unwrap();
        calendar::schedule_post(
            &database,
            &post,
            &past,
            "Asia/Kolkata",
            std::collections::HashMap::from([("instagram".into(), account)]),
        )
        .unwrap();
        if fail {
            let account = list_social_account_id(&database);
            social_accounts::set_mock_failure(&database, &account, true).unwrap();
        }
        (database, post)
    }
    fn list_social_account_id(database: &Database) -> String {
        social_accounts::list_social_accounts(database, None).unwrap()[0]
            .id
            .clone()
    }
    #[test]
    fn mock_publish_is_idempotent() {
        let (database, post) = scheduled(false);
        assert_eq!(tick(&database).unwrap(), 1);
        assert_eq!(
            list_queue(&database, Some("published".into()))
                .unwrap()
                .len(),
            1
        );
        assert_eq!(tick(&database).unwrap(), 0);
        let c = database.connection.lock().unwrap();
        let logs: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM publishing_logs WHERE status='succeeded'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let verified: i64 = c
            .query_row(
                "SELECT json_extract(response_summary,'$.verified') FROM publishing_logs WHERE status='succeeded'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let status: String = c
            .query_row("SELECT status FROM posts WHERE id=?1", [post], |r| r.get(0))
            .unwrap();
        assert_eq!(logs, 1);
        assert_eq!(verified, 1);
        assert_eq!(status, "published");
    }
    #[test]
    fn mock_failure_enters_retry_path() {
        let (database, _) = scheduled(true);
        tick(&database).unwrap();
        let queue = list_queue(&database, None).unwrap();
        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0].status, "retrying");
        assert!(queue[0]
            .last_error
            .as_deref()
            .unwrap()
            .contains("Simulated"));
    }

    #[test]
    fn retry_runs_a_transient_mock_failure_immediately() {
        let (database, post) = scheduled(true);
        tick(&database).unwrap();
        let failed_once = list_queue(&database, None).unwrap();
        assert_eq!(failed_once[0].status, "retrying");

        retry_queue_item(&database, &failed_once[0].id).unwrap();
        assert_eq!(tick(&database).unwrap(), 1);

        let published = list_queue(&database, Some("published".into())).unwrap();
        assert_eq!(published.len(), 1);
        let connection = database.connection.lock().unwrap();
        let status: String = connection
            .query_row("SELECT status FROM posts WHERE id=?1", [post], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(status, "published");
    }

    #[test]
    fn restart_recovers_abandoned_processing_without_duplicate_publish() {
        let (database, _) = scheduled(false);
        enqueue_due(&database).unwrap();
        {
            let connection = database.connection.lock().unwrap();
            connection.execute(
                "UPDATE publishing_queue SET status='publishing',locked_at='2000-01-01T00:00:00Z'",
                [],
            ).unwrap();
            connection
                .execute("UPDATE schedules SET status='processing'", [])
                .unwrap();
        }

        assert_eq!(tick(&database).unwrap(), 1);
        assert_eq!(
            list_queue(&database, Some("published".into()))
                .unwrap()
                .len(),
            1
        );
        assert_eq!(tick(&database).unwrap(), 0);
        let connection = database.connection.lock().unwrap();
        let successes: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM publishing_logs WHERE status='succeeded'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(successes, 1);
    }
}
