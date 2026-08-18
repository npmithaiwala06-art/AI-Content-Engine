use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{content_importer::ImportPlatformInput, database::Database, error::AppError};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostSummary {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub title: String,
    pub topic: String,
    pub content_type: String,
    pub status: String,
    pub source: String,
    pub platforms: Vec<String>,
    pub proposed_publish_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostVersionRecord {
    pub id: String,
    pub platform: String,
    pub hook: String,
    pub caption: String,
    pub cta: String,
    pub hashtags: Vec<String>,
    pub title: String,
    pub description: String,
    pub keywords: Vec<String>,
    pub creative_idea: String,
    pub image_prompt: String,
    pub thumbnail_concept: String,
    pub post_format: String,
    pub video_format: String,
    pub official_media_url: String,
    pub privacy_status: String,
    pub category_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostDetail {
    pub id: String,
    pub client_id: String,
    pub campaign_id: Option<String>,
    pub title: String,
    pub topic: String,
    pub content_type: String,
    pub goal: String,
    pub status: String,
    pub source: String,
    pub proposed_date: String,
    pub proposed_time: String,
    pub timezone: String,
    pub versions: Vec<PostVersionRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentPostInput {
    pub client_id: String,
    pub campaign_id: Option<String>,
    pub title: String,
    pub topic: String,
    pub content_type: String,
    pub goal: String,
    pub proposed_date: String,
    pub proposed_time: String,
    pub timezone: String,
    pub versions: Vec<ImportPlatformInput>,
}

fn required(value: &str, label: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Validation(format!("{label} is required")));
    }
    Ok(())
}

fn proposed_at(date: &str, time: &str) -> Option<String> {
    if date.trim().is_empty() {
        None
    } else {
        Some(format!(
            "{}T{}:00",
            date.trim(),
            if time.trim().is_empty() {
                "09:00"
            } else {
                time.trim()
            }
        ))
    }
}

pub fn list_posts(
    database: &Database,
    client_id: Option<String>,
    status: Option<String>,
    search: Option<String>,
) -> Result<Vec<PostSummary>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let pattern = format!("%{}%", search.unwrap_or_default().trim());
    let mut statement = connection.prepare(
        "SELECT p.id, p.client_id, c.name, COALESCE(p.title,''), COALESCE(p.core_idea,''), p.content_type, p.status, p.source,
                COALESCE((SELECT json_group_array(platform_id) FROM post_versions pv WHERE pv.post_id=p.id AND pv.version_number=1),'[]'),
                p.proposed_publish_at, p.updated_at
         FROM posts p JOIN clients c ON c.id=p.client_id
         WHERE p.deleted_at IS NULL AND (?1 IS NULL OR p.client_id=?1) AND (?2 IS NULL OR ?2='all' OR p.status=?2)
           AND (?3='%%' OR p.title LIKE ?3 OR p.core_idea LIKE ?3)
         ORDER BY p.updated_at DESC LIMIT 200"
    )?;
    let rows = statement.query_map(params![client_id, status, pattern], |row| {
        let platforms: String = row.get(8)?;
        Ok(PostSummary {
            id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            title: row.get(3)?,
            topic: row.get(4)?,
            content_type: row.get(5)?,
            status: row.get(6)?,
            source: row.get(7)?,
            platforms: serde_json::from_str(&platforms).unwrap_or_default(),
            proposed_publish_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn get_post(database: &Database, post_id: &str) -> Result<PostDetail, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let row = connection.query_row(
        "SELECT id, client_id, campaign_id, COALESCE(title,''), COALESCE(core_idea,''), content_type, COALESCE(goal,''), status, source, COALESCE(proposed_publish_at,''), timezone FROM posts WHERE id=?1 AND deleted_at IS NULL",
        [post_id], |row| Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,Option<String>>(2)?,row.get::<_,String>(3)?,row.get::<_,String>(4)?,row.get::<_,String>(5)?,row.get::<_,String>(6)?,row.get::<_,String>(7)?,row.get::<_,String>(8)?,row.get::<_,String>(9)?,row.get::<_,String>(10)?)),
    ).optional()?.ok_or_else(|| AppError::NotFound("Post not found".into()))?;
    let mut statement = connection.prepare("SELECT id, platform_id, COALESCE(hook,''), COALESCE(caption,''), COALESCE(cta,''), hashtags, COALESCE(title,''), COALESCE(description,''), keywords, COALESCE(creative_idea,''), COALESCE(image_prompt,''), COALESCE(thumbnail_concept,''), platform_metadata FROM post_versions WHERE post_id=?1 AND version_number=1 ORDER BY platform_id")?;
    let versions = statement
        .query_map([post_id], |version| {
            let hashtags: String = version.get(5)?;
            let keywords: String = version.get(8)?;
            let metadata: String = version.get(12)?;
            let metadata: serde_json::Value = serde_json::from_str(&metadata).unwrap_or_default();
            Ok(PostVersionRecord {
                id: version.get(0)?,
                platform: version.get(1)?,
                hook: version.get(2)?,
                caption: version.get(3)?,
                cta: version.get(4)?,
                hashtags: serde_json::from_str(&hashtags).unwrap_or_default(),
                title: version.get(6)?,
                description: version.get(7)?,
                keywords: serde_json::from_str(&keywords).unwrap_or_default(),
                creative_idea: version.get(9)?,
                image_prompt: version.get(10)?,
                thumbnail_concept: version.get(11)?,
                post_format: metadata
                    .get("post_format")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .into(),
                video_format: metadata
                    .get("video_format")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .into(),
                official_media_url: metadata
                    .get("official_media_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .into(),
                privacy_status: metadata
                    .get("privacy_status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("private")
                    .into(),
                category_id: metadata
                    .get("category_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("22")
                    .into(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let (proposed_date, proposed_time) = if row.9.len() >= 16 {
        (row.9[..10].into(), row.9[11..16].into())
    } else {
        (String::new(), String::new())
    };
    Ok(PostDetail {
        id: row.0,
        client_id: row.1,
        campaign_id: row.2,
        title: row.3,
        topic: row.4,
        content_type: row.5,
        goal: row.6,
        status: row.7,
        source: row.8,
        proposed_date,
        proposed_time,
        timezone: row.10,
        versions,
    })
}

fn validate(input: &ContentPostInput) -> Result<(), AppError> {
    required(&input.client_id, "Client")?;
    required(&input.title, "Title")?;
    required(&input.topic, "Topic")?;
    required(&input.content_type, "Content type")?;
    if input.versions.is_empty() {
        return Err(AppError::Validation("Select at least one platform".into()));
    }
    let mut platforms = std::collections::HashSet::new();
    for version in &input.versions {
        if !["instagram", "facebook", "linkedin", "youtube"].contains(&version.platform.as_str()) {
            return Err(AppError::Validation(format!(
                "Unsupported platform: {}",
                version.platform
            )));
        }
        if !platforms.insert(version.platform.as_str()) {
            return Err(AppError::Validation(format!(
                "{} was selected more than once",
                version.platform
            )));
        }
        if version.caption.trim().is_empty()
            && version.description.trim().is_empty()
            && version.title.trim().is_empty()
        {
            return Err(AppError::Validation(format!(
                "Add content for {} before saving",
                version.platform
            )));
        }
    }
    Ok(())
}

pub fn save_post(
    database: &Database,
    post_id: Option<String>,
    input: ContentPostInput,
) -> Result<String, AppError> {
    validate(&input)?;
    let id = post_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;
    let exists: bool = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM posts WHERE id=?1 AND deleted_at IS NULL)",
        [&id],
        |row| row.get(0),
    )?;
    if exists {
        let changed = transaction.execute("UPDATE posts SET client_id=?2,campaign_id=?3,title=?4,core_idea=?5,content_type=?6,goal=?7,status='draft',proposed_publish_at=?8,timezone=?9,updated_at=?10 WHERE id=?1 AND status NOT IN ('published','publishing')", params![id,input.client_id,input.campaign_id,input.title.trim(),input.topic.trim(),input.content_type,input.goal.trim(),proposed_at(&input.proposed_date,&input.proposed_time),input.timezone,now])?;
        if changed == 0 {
            return Err(AppError::Validation(
                "Publishing or Published posts cannot be changed".into(),
            ));
        }
        transaction.execute("DELETE FROM post_versions WHERE post_id=?1", [&id])?;
    } else {
        transaction.execute("INSERT INTO posts (id,client_id,campaign_id,title,core_idea,content_type,goal,status,source,proposed_publish_at,timezone,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'draft','manual',?8,?9,?10,?10)", params![id,input.client_id,input.campaign_id,input.title.trim(),input.topic.trim(),input.content_type,input.goal.trim(),proposed_at(&input.proposed_date,&input.proposed_time),input.timezone,now])?;
    }
    for version in input.versions {
        let metadata = serde_json::json!({"post_format":version.post_format,"video_format":version.video_format,"official_media_url":version.official_media_url,"privacy_status":version.privacy_status,"category_id":version.category_id});
        transaction.execute("INSERT INTO post_versions (id,post_id,platform_id,hook,caption,cta,hashtags,title,description,keywords,creative_idea,image_prompt,thumbnail_concept,platform_metadata,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)", params![Uuid::new_v4().to_string(),id,version.platform,version.hook,version.caption,version.cta,serde_json::to_string(&version.hashtags)?,version.title,version.description,serde_json::to_string(&version.keywords)?,version.creative_idea,version.image_prompt,version.thumbnail_concept,metadata.to_string(),now])?;
    }
    transaction.execute("INSERT INTO activity_logs (id,client_id,entity_type,entity_id,action,summary) VALUES (?1,?2,'post',?3,'saved','Content saved as Draft')",params![Uuid::new_v4().to_string(),input.client_id,id])?;
    transaction.commit()?;
    Ok(id)
}

pub fn duplicate_post(database: &Database, post_id: &str) -> Result<String, AppError> {
    let detail = get_post(database, post_id)?;
    let versions = detail
        .versions
        .into_iter()
        .map(|v| ImportPlatformInput {
            platform: v.platform,
            hook: v.hook,
            caption: v.caption,
            cta: v.cta,
            hashtags: v.hashtags,
            title: v.title,
            description: v.description,
            keywords: v.keywords,
            creative_idea: v.creative_idea,
            image_prompt: v.image_prompt,
            thumbnail_concept: v.thumbnail_concept,
            post_format: v.post_format,
            video_format: v.video_format,
            official_media_url: v.official_media_url,
            privacy_status: v.privacy_status,
            category_id: v.category_id,
        })
        .collect();
    let duplicate_id = save_post(
        database,
        None,
        ContentPostInput {
            client_id: detail.client_id,
            campaign_id: detail.campaign_id,
            title: format!("{} — Copy", detail.title),
            topic: detail.topic,
            content_type: detail.content_type,
            goal: detail.goal,
            proposed_date: detail.proposed_date,
            proposed_time: detail.proposed_time,
            timezone: detail.timezone,
            versions,
        },
    )?;
    let connection = database.connection.lock().expect("database lock poisoned");
    connection.execute(
        "UPDATE posts SET source='duplicate' WHERE id=?1",
        [&duplicate_id],
    )?;
    Ok(duplicate_id)
}

pub fn submit_post_for_review(database: &Database, post_id: &str) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let tx = connection.transaction()?;
    let changed=tx.execute("UPDATE posts SET status='needs_review',updated_at=?2 WHERE id=?1 AND status IN ('draft','rejected') AND deleted_at IS NULL",params![post_id,now])?;
    if changed == 0 {
        return Err(AppError::Validation(
            "Only Draft or Rejected posts can be submitted".into(),
        ));
    }
    tx.execute("INSERT INTO approvals (id,post_id,decision,notes,decided_at) VALUES (?1,?2,'submitted','Submitted from Content Studio',?3)",params![Uuid::new_v4().to_string(),post_id,now])?;
    tx.execute("INSERT INTO activity_logs (id,client_id,entity_type,entity_id,action,summary) SELECT ?1,client_id,'post',id,'submitted_for_review','Post submitted for human approval' FROM posts WHERE id=?2",params![Uuid::new_v4().to_string(),post_id])?;
    tx.commit()?;
    drop(connection);
    crate::automation::add_notification(
        database,
        "approval_required",
        "Post needs approval",
        "A local draft is ready for human review",
        "post",
        post_id,
    )?;
    Ok(())
}

pub fn delete_draft_post(database: &Database, post_id: &str) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    let connection = database.connection.lock().expect("database lock poisoned");
    let changed = connection.execute("UPDATE posts SET deleted_at=?2,updated_at=?2 WHERE id=?1 AND status IN ('draft','rejected','paused')",params![post_id,now])?;
    if changed == 0 {
        return Err(AppError::Validation(
            "Only Draft, Rejected or Paused posts can be deleted".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::{clients, database::Database};
    use rusqlite::Connection;
    use std::sync::Mutex;

    fn database() -> Database {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        Database {
            connection: Mutex::new(connection),
            app_data_dir: std::env::temp_dir(),
        }
    }

    pub(crate) fn input(client_id: String) -> ContentPostInput {
        ContentPostInput {
            client_id,
            campaign_id: None,
            title: "Weekend Coffee".into(),
            topic: "Weekend visits".into(),
            content_type: "image_post".into(),
            goal: "Increase visits".into(),
            proposed_date: "2026-08-22".into(),
            proposed_time: "10:00".into(),
            timezone: "Asia/Kolkata".into(),
            versions: vec![ImportPlatformInput {
                platform: "instagram".into(),
                hook: "Weekend starts here".into(),
                caption: "Fresh coffee is waiting.".into(),
                cta: "Visit us".into(),
                hashtags: vec!["#Coffee".into()],
                title: String::new(),
                description: String::new(),
                keywords: vec![],
                creative_idea: "Warm cafe photo".into(),
                image_prompt: "Editorial cafe photo".into(),
                thumbnail_concept: String::new(),
                post_format: "image".into(),
                video_format: String::new(),
                official_media_url: String::new(),
                privacy_status: "private".into(),
                category_id: "22".into(),
            }],
        }
    }

    #[test]
    fn creates_edits_duplicates_submits_and_soft_deletes_drafts() {
        let database = database();
        let client_id = clients::create_client(&database, clients::tests::input()).unwrap();
        let id = save_post(&database, None, input(client_id.clone())).unwrap();
        let mut edited = input(client_id);
        edited.title = "Edited Weekend Coffee".into();
        save_post(&database, Some(id.clone()), edited).unwrap();
        assert_eq!(
            get_post(&database, &id).unwrap().title,
            "Edited Weekend Coffee"
        );

        let duplicate_id = duplicate_post(&database, &id).unwrap();
        assert_eq!(
            get_post(&database, &duplicate_id).unwrap().source,
            "duplicate"
        );
        submit_post_for_review(&database, &id).unwrap();
        assert_eq!(get_post(&database, &id).unwrap().status, "needs_review");
        assert!(delete_draft_post(&database, &id).is_err());
        delete_draft_post(&database, &duplicate_id).unwrap();
        assert!(matches!(
            get_post(&database, &duplicate_id),
            Err(AppError::NotFound(_))
        ));
    }
}
