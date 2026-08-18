use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use uuid::Uuid;

use crate::{database::Database, error::AppError};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalItem {
    pub post_id: String,
    pub client_id: String,
    pub client_name: String,
    pub campaign_name: Option<String>,
    pub title: String,
    pub topic: String,
    pub content_type: String,
    pub proposed_publish_at: Option<String>,
    pub timezone: String,
    pub platform: String,
    pub hook: String,
    pub caption: String,
    pub cta: String,
    pub hashtags: Vec<String>,
    pub creative_idea: String,
    pub media_path: Option<String>,
    pub submitted_at: String,
}

pub fn list_approval_queue(
    database: &Database,
    client_id: Option<String>,
) -> Result<Vec<ApprovalItem>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut statement = connection.prepare("SELECT p.id,p.client_id,c.name,ca.name,COALESCE(p.title,''),COALESCE(p.core_idea,''),p.content_type,p.proposed_publish_at,p.timezone,pv.platform_id,COALESCE(pv.hook,''),COALESCE(pv.caption,pv.description,''),COALESCE(pv.cta,''),pv.hashtags,COALESCE(pv.creative_idea,pv.thumbnail_concept,''),(SELECT m.relative_path FROM post_media pm JOIN media m ON m.id=pm.media_id WHERE pm.post_version_id=pv.id AND m.deleted_at IS NULL ORDER BY pm.sort_order,pm.media_id LIMIT 1),p.updated_at FROM posts p JOIN clients c ON c.id=p.client_id LEFT JOIN campaigns ca ON ca.id=p.campaign_id JOIN post_versions pv ON pv.post_id=p.id AND pv.version_number=1 WHERE p.status='needs_review' AND p.deleted_at IS NULL AND (?1 IS NULL OR p.client_id=?1) ORDER BY p.updated_at ASC,pv.platform_id")?;
    let rows = statement.query_map([client_id], |row| {
        let hashtags: String = row.get(13)?;
        let relative_media_path: Option<String> = row.get(15)?;
        Ok(ApprovalItem {
            post_id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            campaign_name: row.get(3)?,
            title: row.get(4)?,
            topic: row.get(5)?,
            content_type: row.get(6)?,
            proposed_publish_at: row.get(7)?,
            timezone: row.get(8)?,
            platform: row.get(9)?,
            hook: row.get(10)?,
            caption: row.get(11)?,
            cta: row.get(12)?,
            hashtags: serde_json::from_str(&hashtags).unwrap_or_default(),
            creative_idea: row.get(14)?,
            media_path: relative_media_path.map(|path| {
                database
                    .app_data_dir
                    .join(path)
                    .to_string_lossy()
                    .into_owned()
            }),
            submitted_at: row.get(16)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn decide(database: &Database, post_id: &str, decision: &str, notes: &str) -> Result<(), AppError> {
    let status = if decision == "approved" {
        "approved"
    } else {
        "rejected"
    };
    if decision == "rejected" && notes.trim().is_empty() {
        return Err(AppError::Validation(
            "A rejection reason is required".into(),
        ));
    }
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let tx = connection.transaction()?;
    let client_id: Option<String> = tx.query_row("SELECT client_id FROM posts WHERE id=?1 AND status='needs_review' AND deleted_at IS NULL", [post_id], |row| row.get(0)).optional()?;
    let client_id = client_id
        .ok_or_else(|| AppError::Validation("Only posts awaiting review can be decided".into()))?;
    tx.execute(
        "UPDATE posts SET status=?2,updated_at=?3 WHERE id=?1",
        params![post_id, status, now],
    )?;
    tx.execute(
        "INSERT INTO approvals (id,post_id,decision,notes,decided_at) VALUES (?1,?2,?3,?4,?5)",
        params![
            Uuid::new_v4().to_string(),
            post_id,
            decision,
            notes.trim(),
            now
        ],
    )?;
    tx.execute("INSERT INTO activity_logs (id,client_id,entity_type,entity_id,action,summary) VALUES (?1,?2,'post',?3,?4,?5)", params![Uuid::new_v4().to_string(),client_id,post_id,decision,if decision=="approved"{"Post approved by local user"}else{"Post rejected by local user"}])?;
    tx.commit()?;
    Ok(())
}

pub fn approve_post(database: &Database, post_id: &str, notes: &str) -> Result<(), AppError> {
    decide(database, post_id, "approved", notes)
}
pub fn reject_post(database: &Database, post_id: &str, reason: &str) -> Result<(), AppError> {
    decide(database, post_id, "rejected", reason)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{clients, content_studio, database::Database, media_library};
    use rusqlite::Connection;
    use std::sync::Mutex;
    #[test]
    fn requires_review_and_records_human_decisions() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        let app_data_dir =
            std::env::temp_dir().join(format!("socialflow-approval-media-{}", Uuid::new_v4()));
        let database = Database {
            connection: Mutex::new(connection),
            app_data_dir: app_data_dir.clone(),
        };
        let client = clients::create_client(&database, clients::tests::input()).unwrap();
        let id = content_studio::save_post(
            &database,
            None,
            content_studio::tests::input(client.clone()),
        )
        .unwrap();
        let media_id = media_library::upload_media(
            &database,
            media_library::MediaUpload {
                client_id: Some(client),
                campaign_id: None,
                kind: "creative".into(),
                file_name: "approval-thumbnail.png".into(),
                mime_type: "image/png".into(),
                tags: vec!["approval".into()],
                platforms: vec!["instagram".into()],
                bytes: vec![137, 80, 78, 71],
            },
        )
        .unwrap();
        media_library::attach_media(&database, &id, "instagram", &media_id).unwrap();
        assert!(approve_post(&database, &id, "").is_err());
        content_studio::submit_post_for_review(&database, &id).unwrap();
        let queue = list_approval_queue(&database, None).unwrap();
        assert_eq!(queue.len(), 1);
        assert!(queue[0]
            .media_path
            .as_deref()
            .is_some_and(|path| path.ends_with(".png")));
        approve_post(&database, &id, "Looks good").unwrap();
        assert!(list_approval_queue(&database, None).unwrap().is_empty());
        let _ = std::fs::remove_dir_all(app_data_dir);
    }
}
