use std::collections::HashSet;

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{database::Database, error::AppError};

const ALLOWED_PLATFORMS: [&str; 4] = ["instagram", "facebook", "linkedin", "youtube"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlatformInput {
    pub platform: String,
    #[serde(default)]
    pub hook: String,
    #[serde(default)]
    pub caption: String,
    #[serde(default)]
    pub cta: String,
    #[serde(default)]
    pub hashtags: Vec<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub creative_idea: String,
    #[serde(default)]
    pub image_prompt: String,
    #[serde(default)]
    pub thumbnail_concept: String,
    #[serde(default)]
    pub post_format: String,
    #[serde(default)]
    pub video_format: String,
    #[serde(default)]
    pub official_media_url: String,
    #[serde(default = "default_youtube_privacy")]
    pub privacy_status: String,
    #[serde(default = "default_youtube_category")]
    pub category_id: String,
}

fn default_youtube_privacy() -> String {
    "private".into()
}
fn default_youtube_category() -> String {
    "22".into()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPostInput {
    pub temp_id: String,
    pub title: String,
    pub topic: String,
    pub goal: String,
    pub content_type: String,
    pub scheduled_date: Option<String>,
    pub recommended_time: Option<String>,
    pub timezone: Option<String>,
    pub platforms: Vec<ImportPlatformInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveContentImportInput {
    pub client_id: String,
    pub ai_prompt_id: Option<String>,
    pub raw_content: String,
    pub parsed_post_count: i64,
    pub posts: Vec<ImportPostInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentImportSaveResult {
    pub batch_id: String,
    pub saved_post_ids: Vec<String>,
    pub duplicate_temp_ids: Vec<String>,
}

fn required(value: &str, label: &str, max: usize) -> Result<(), AppError> {
    let length = value.trim().chars().count();
    if length == 0 {
        return Err(AppError::Validation(format!("{label} is required")));
    }
    if length > max {
        return Err(AppError::Validation(format!(
            "{label} must be {max} characters or fewer"
        )));
    }
    Ok(())
}

fn normalise(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn fingerprint(post: &ImportPostInput) -> String {
    let mut versions = post
        .platforms
        .iter()
        .map(|version| {
            format!(
                "{}:{}:{}:{}",
                version.platform,
                normalise(&version.title),
                normalise(&version.hook),
                normalise(&format!("{} {}", version.caption, version.description))
            )
        })
        .collect::<Vec<_>>();
    versions.sort();
    let signature = format!(
        "{}|{}|{}|{}",
        normalise(&post.title),
        normalise(&post.topic),
        normalise(&post.content_type),
        versions.join("|")
    );
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in signature.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn validate_post(post: &ImportPostInput) -> Result<(), AppError> {
    required(&post.temp_id, "Temporary post ID", 120)?;
    required(&post.title, "Post title", 300)?;
    required(&post.topic, "Post topic", 1000)?;
    required(&post.content_type, "Content type", 100)?;
    if post.platforms.is_empty() {
        return Err(AppError::Validation(format!(
            "{} must include at least one platform version",
            post.title
        )));
    }
    let mut seen = HashSet::new();
    for version in &post.platforms {
        if !ALLOWED_PLATFORMS.contains(&version.platform.as_str()) {
            return Err(AppError::Validation(format!(
                "Unsupported platform: {}",
                version.platform
            )));
        }
        if !seen.insert(version.platform.as_str()) {
            return Err(AppError::Validation(format!(
                "{} contains duplicate {} content",
                post.title, version.platform
            )));
        }
        if version.caption.trim().is_empty()
            && version.description.trim().is_empty()
            && version.title.trim().is_empty()
        {
            return Err(AppError::Validation(format!(
                "{} has no usable content for {}",
                post.title, version.platform
            )));
        }
    }
    Ok(())
}

fn proposed_publish_at(post: &ImportPostInput) -> Option<String> {
    let date = post.scheduled_date.as_deref()?.trim();
    if date.is_empty() {
        return None;
    }
    let time = post
        .recommended_time
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("09:00");
    Some(format!("{date}T{time}:00"))
}

pub fn check_import_duplicates(
    database: &Database,
    client_id: &str,
    posts: &[ImportPostInput],
) -> Result<Vec<String>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut duplicates = Vec::new();
    for post in posts {
        validate_post(post)?;
        let exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM posts WHERE client_id=?1 AND import_fingerprint=?2 AND deleted_at IS NULL)",
            params![client_id, fingerprint(post)], |row| row.get(0),
        )?;
        if exists {
            duplicates.push(post.temp_id.clone());
        }
    }
    Ok(duplicates)
}

pub fn save_content_import(
    database: &Database,
    input: SaveContentImportInput,
) -> Result<ContentImportSaveResult, AppError> {
    if input.posts.is_empty() || input.posts.len() > 100 {
        return Err(AppError::Validation(
            "Select between 1 and 100 posts to import".into(),
        ));
    }
    if input.raw_content.is_empty() || input.raw_content.len() > 1_000_000 {
        return Err(AppError::Validation(
            "ChatGPT result must be between 1 byte and 1 MB".into(),
        ));
    }
    for post in &input.posts {
        validate_post(post)?;
    }

    let batch_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let mut saved_post_ids = Vec::new();
    let mut duplicate_temp_ids = Vec::new();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;
    let client_name: Option<String> = transaction
        .query_row(
            "SELECT name FROM clients WHERE id=?1 AND archived_at IS NULL",
            [&input.client_id],
            |row| row.get(0),
        )
        .optional()?;
    let client_name = client_name.ok_or_else(|| AppError::NotFound("Client not found".into()))?;

    if let Some(prompt_id) = input.ai_prompt_id.as_deref() {
        let belongs: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM ai_prompts WHERE id=?1 AND client_id=?2)",
            params![prompt_id, input.client_id],
            |row| row.get(0),
        )?;
        if !belongs {
            return Err(AppError::Validation(
                "Prompt history record does not belong to this client".into(),
            ));
        }
    }

    transaction.execute(
        "INSERT INTO content_imports (id, client_id, ai_prompt_id, raw_content, parsed_post_count, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'parsed', ?6, ?6)",
        params![batch_id, input.client_id, input.ai_prompt_id, input.raw_content, input.parsed_post_count, now],
    )?;

    for post in input.posts {
        let post_fingerprint = fingerprint(&post);
        let duplicate: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM posts WHERE client_id=?1 AND import_fingerprint=?2 AND deleted_at IS NULL)",
            params![input.client_id, post_fingerprint], |row| row.get(0),
        )?;
        if duplicate {
            duplicate_temp_ids.push(post.temp_id);
            continue;
        }

        let post_id = Uuid::new_v4().to_string();
        let timezone = post.timezone.as_deref().unwrap_or("Asia/Kolkata");
        transaction.execute(
            "INSERT INTO posts (id, client_id, title, core_idea, content_type, goal, status, source, import_batch_id, import_fingerprint, proposed_publish_at, timezone, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', 'chatgpt_import', ?7, ?8, ?9, ?10, ?11, ?11)",
            params![post_id, input.client_id, post.title.trim(), post.topic.trim(), post.content_type.trim(), post.goal.trim(), batch_id, post_fingerprint, proposed_publish_at(&post), timezone, now],
        )?;

        for version in post.platforms {
            let metadata = json!({
                "post_format": version.post_format,
                "video_format": version.video_format,
                "recommended_time": post.recommended_time,
                "scheduled_date": post.scheduled_date,
                "import_format": "social_content_v1"
            });
            transaction.execute(
                "INSERT INTO post_versions (id, post_id, platform_id, hook, caption, cta, hashtags, title, description, keywords, creative_idea, image_prompt, thumbnail_concept, platform_metadata, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
                params![Uuid::new_v4().to_string(), post_id, version.platform, version.hook.trim(), version.caption.trim(), version.cta.trim(), serde_json::to_string(&version.hashtags)?, version.title.trim(), version.description.trim(), serde_json::to_string(&version.keywords)?, version.creative_idea.trim(), version.image_prompt.trim(), version.thumbnail_concept.trim(), metadata.to_string(), now],
            )?;
        }
        saved_post_ids.push(post_id);
    }

    transaction.execute(
        "UPDATE content_imports SET saved_post_count=?2, duplicate_count=?3, status='saved', updated_at=?4 WHERE id=?1",
        params![batch_id, saved_post_ids.len() as i64, duplicate_temp_ids.len() as i64, now],
    )?;
    transaction.execute(
        "INSERT INTO activity_logs (id, client_id, entity_type, entity_id, action, summary, metadata)
         VALUES (?1, ?2, 'content_import', ?3, 'imported', ?4, ?5)",
        params![Uuid::new_v4().to_string(), input.client_id, batch_id, format!("Imported {} ChatGPT draft posts for {client_name}", saved_post_ids.len()), json!({"saved": saved_post_ids.len(), "duplicates": duplicate_temp_ids.len()}).to_string()],
    )?;
    transaction.commit()?;
    Ok(ContentImportSaveResult {
        batch_id,
        saved_post_ids,
        duplicate_temp_ids,
    })
}

#[cfg(test)]
mod tests {
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

    fn version(platform: &str, caption: &str) -> ImportPlatformInput {
        ImportPlatformInput {
            platform: platform.into(),
            hook: "Strong hook".into(),
            caption: caption.into(),
            cta: "Visit us".into(),
            hashtags: vec!["#Local".into()],
            title: String::new(),
            description: String::new(),
            keywords: vec![],
            creative_idea: "Cafe photo".into(),
            image_prompt: "Warm cafe photo".into(),
            thumbnail_concept: String::new(),
            post_format: "image".into(),
            video_format: String::new(),
            official_media_url: String::new(),
            privacy_status: "private".into(),
            category_id: "22".into(),
        }
    }

    fn post(temp_id: &str) -> ImportPostInput {
        ImportPostInput {
            temp_id: temp_id.into(),
            title: "Weekend Coffee Offer".into(),
            topic: "Weekend promotion".into(),
            goal: "Increase visits".into(),
            content_type: "image_post".into(),
            scheduled_date: Some("2026-08-17".into()),
            recommended_time: Some("10:00".into()),
            timezone: Some("Asia/Kolkata".into()),
            platforms: vec![
                version("instagram", "Start your weekend with us."),
                version("facebook", "Bring a friend for coffee this weekend."),
            ],
        }
    }

    #[test]
    fn imports_platform_versions_as_drafts_and_skips_duplicates() {
        let database = database();
        let client_id = clients::create_client(&database, clients::tests::input()).unwrap();
        let result = save_content_import(
            &database,
            SaveContentImportInput {
                client_id: client_id.clone(),
                ai_prompt_id: None,
                raw_content: "{\"format_version\":\"social_content_v1\"}".into(),
                parsed_post_count: 2,
                posts: vec![post("post-1"), post("post-2")],
            },
        )
        .unwrap();
        assert_eq!(result.saved_post_ids.len(), 1);
        assert_eq!(result.duplicate_temp_ids, vec!["post-2"]);
        let connection = database.connection.lock().unwrap();
        let posts: i64 = connection.query_row("SELECT COUNT(*) FROM posts WHERE client_id=?1 AND status='draft' AND source='chatgpt_import'", [&client_id], |row| row.get(0)).unwrap();
        let versions: i64 = connection
            .query_row("SELECT COUNT(*) FROM post_versions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(posts, 1);
        assert_eq!(versions, 2);
    }
}
