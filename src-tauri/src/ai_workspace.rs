use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{database::Database, error::AppError};

const ALLOWED_TEMPLATES: [&str; 5] = ["single_post", "7_day", "15_day", "30_day", "campaign"];
const ALLOWED_PLATFORMS: [&str; 4] = ["instagram", "facebook", "twitter", "youtube"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignOption {
    pub id: String,
    pub name: String,
    pub objective: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiPromptInput {
    pub client_id: String,
    pub campaign_id: Option<String>,
    pub template_type: String,
    pub goal: String,
    pub topic: String,
    pub content_type: String,
    pub tone: String,
    pub platforms: Vec<String>,
    pub post_count: i64,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub prompt_text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPromptHistoryItem {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub brand_name: String,
    pub campaign_name: Option<String>,
    pub template_type: String,
    pub goal: String,
    pub topic: String,
    pub platforms: Vec<String>,
    pub post_count: i64,
    pub prompt_text: String,
    pub copy_count: i64,
    pub last_copied_at: Option<String>,
    pub created_at: String,
}

fn required(value: &str, label: &str, max_length: usize) -> Result<String, AppError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(AppError::Validation(format!("{label} is required")));
    }
    if value.chars().count() > max_length {
        return Err(AppError::Validation(format!(
            "{label} must be {max_length} characters or fewer"
        )));
    }
    Ok(value.to_owned())
}

pub fn list_campaign_options(
    database: &Database,
    client_id: &str,
) -> Result<Vec<CampaignOption>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut statement = connection.prepare(
        "SELECT id, name, COALESCE(objective,''), status
         FROM campaigns
         WHERE client_id=?1 AND status != 'archived'
         ORDER BY updated_at DESC, name COLLATE NOCASE ASC",
    )?;
    let rows = statement.query_map([client_id], |row| {
        Ok(CampaignOption {
            id: row.get(0)?,
            name: row.get(1)?,
            objective: row.get(2)?,
            status: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn save_ai_prompt(database: &Database, input: SaveAiPromptInput) -> Result<String, AppError> {
    if !ALLOWED_TEMPLATES.contains(&input.template_type.as_str()) {
        return Err(AppError::Validation("Invalid prompt template".into()));
    }
    if !(1..=100).contains(&input.post_count) {
        return Err(AppError::Validation(
            "Post count must be between 1 and 100".into(),
        ));
    }
    if input.platforms.is_empty()
        || input
            .platforms
            .iter()
            .any(|platform| !ALLOWED_PLATFORMS.contains(&platform.as_str()))
    {
        return Err(AppError::Validation(
            "Select at least one supported platform".into(),
        ));
    }
    if let (Some(start), Some(end)) = (&input.start_date, &input.end_date) {
        if !start.is_empty() && !end.is_empty() && start > end {
            return Err(AppError::Validation(
                "End date cannot be before start date".into(),
            ));
        }
    }

    let goal = required(&input.goal, "Goal", 500)?;
    let topic = required(&input.topic, "Topic", 500)?;
    let content_type = required(&input.content_type, "Content type", 100)?;
    let tone = required(&input.tone, "Tone", 300)?;
    let prompt_text = required(&input.prompt_text, "Prompt", 200_000)?;
    let platforms = serde_json::to_string(&input.platforms)?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

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

    if let Some(campaign_id) = input.campaign_id.as_deref() {
        let belongs_to_client: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM campaigns WHERE id=?1 AND client_id=?2)",
            params![campaign_id, input.client_id],
            |row| row.get(0),
        )?;
        if !belongs_to_client {
            return Err(AppError::Validation(
                "Campaign does not belong to the selected client".into(),
            ));
        }
    }

    transaction.execute(
        "INSERT INTO ai_prompts
         (id, client_id, campaign_id, template_type, goal, topic, content_type, tone, platforms, post_count, start_date, end_date, prompt_text, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)",
        params![
            id,
            input.client_id,
            input.campaign_id,
            input.template_type,
            goal,
            topic,
            content_type,
            tone,
            platforms,
            input.post_count,
            input.start_date.filter(|value| !value.is_empty()),
            input.end_date.filter(|value| !value.is_empty()),
            prompt_text,
            now,
        ],
    )?;
    transaction.execute(
        "INSERT INTO activity_logs
         (id, client_id, entity_type, entity_id, action, summary)
         VALUES (?1, ?2, 'ai_prompt', ?3, 'generated', ?4)",
        params![
            Uuid::new_v4().to_string(),
            input.client_id,
            id,
            format!("ChatGPT prompt generated for {client_name}"),
        ],
    )?;
    transaction.commit()?;
    Ok(id)
}

pub fn list_ai_prompt_history(
    database: &Database,
    client_id: Option<String>,
) -> Result<Vec<AiPromptHistoryItem>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut statement = connection.prepare(
        "SELECT ap.id, ap.client_id, c.name,
                COALESCE(NULLIF(c.brand_name,''), NULLIF(c.company_name,''), c.name),
                ca.name, ap.template_type, ap.goal, ap.topic, ap.platforms,
                ap.post_count, ap.prompt_text, ap.copy_count, ap.last_copied_at, ap.created_at
         FROM ai_prompts ap
         JOIN clients c ON c.id=ap.client_id
         LEFT JOIN campaigns ca ON ca.id=ap.campaign_id
         WHERE (?1 IS NULL OR ap.client_id=?1)
         ORDER BY ap.created_at DESC
         LIMIT 30",
    )?;
    let rows = statement.query_map([client_id], |row| {
        let platforms: String = row.get(8)?;
        Ok(AiPromptHistoryItem {
            id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            brand_name: row.get(3)?,
            campaign_name: row.get(4)?,
            template_type: row.get(5)?,
            goal: row.get(6)?,
            topic: row.get(7)?,
            platforms: serde_json::from_str(&platforms).unwrap_or_default(),
            post_count: row.get(9)?,
            prompt_text: row.get(10)?,
            copy_count: row.get(11)?,
            last_copied_at: row.get(12)?,
            created_at: row.get(13)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn mark_ai_prompt_copied(database: &Database, prompt_id: &str) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;
    let client_id: Option<String> = transaction
        .query_row(
            "SELECT client_id FROM ai_prompts WHERE id=?1",
            [prompt_id],
            |row| row.get(0),
        )
        .optional()?;
    let client_id = client_id.ok_or_else(|| AppError::NotFound("Prompt not found".into()))?;
    transaction.execute(
        "UPDATE ai_prompts
         SET copy_count=copy_count+1, last_copied_at=?2, updated_at=?2
         WHERE id=?1",
        params![prompt_id, now],
    )?;
    transaction.execute(
        "INSERT INTO activity_logs
         (id, client_id, entity_type, entity_id, action, summary)
         VALUES (?1, ?2, 'ai_prompt', ?3, 'copied', 'ChatGPT prompt copied for manual use')",
        params![Uuid::new_v4().to_string(), client_id, prompt_id],
    )?;
    transaction.commit()?;
    Ok(())
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

    #[test]
    fn saves_lists_and_marks_a_manual_prompt_as_copied() {
        let database = database();
        let client_id = clients::create_client(&database, clients::tests::input()).unwrap();
        let prompt_id = save_ai_prompt(
            &database,
            SaveAiPromptInput {
                client_id: client_id.clone(),
                campaign_id: None,
                template_type: "7_day".into(),
                goal: "Increase weekend visits".into(),
                topic: "Weekend coffee".into(),
                content_type: "mixed".into(),
                tone: "Friendly".into(),
                platforms: vec!["instagram".into(), "facebook".into()],
                post_count: 7,
                start_date: Some("2026-08-17".into()),
                end_date: Some("2026-08-23".into()),
                prompt_text: "Create structured platform-specific content in JSON.".into(),
            },
        )
        .unwrap();

        let history = list_ai_prompt_history(&database, Some(client_id)).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].platforms, vec!["instagram", "facebook"]);
        assert_eq!(history[0].copy_count, 0);

        mark_ai_prompt_copied(&database, &prompt_id).unwrap();
        let copied = list_ai_prompt_history(&database, None).unwrap();
        assert_eq!(copied[0].copy_count, 1);
        assert!(copied[0].last_copied_at.is_some());
    }
}
