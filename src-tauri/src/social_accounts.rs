use crate::{
    database::Database,
    error::AppError,
    platforms::{official_adapter, PlatformAdapter},
    security::OAuthCredentialBundle,
};
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialAccountRecord {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub platform: String,
    pub account_name: String,
    pub external_account_id: Option<String>,
    pub connection_status: String,
    pub token_expires_at: Option<String>,
    pub last_validated_at: Option<String>,
    pub mock_fail_next: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialConnectionInput {
    pub client_id: String,
    pub platform: String,
    pub account_name: String,
    pub external_account_id: String,
    pub access_token: String,
    pub token_expires_at: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub oauth_client_id: Option<String>,
    #[serde(default)]
    pub oauth_client_secret: Option<String>,
    #[serde(default)]
    pub token_endpoint: Option<String>,
    #[serde(default)]
    pub settings: Value,
}

pub fn list_social_accounts(
    database: &Database,
    client_id: Option<String>,
) -> Result<Vec<SocialAccountRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT sa.id,sa.client_id,c.name,sa.platform_id,sa.account_name,sa.external_account_id,sa.connection_status,sa.token_expires_at,sa.last_validated_at,COALESCE(json_extract(sa.settings,'$.fail_next'),0) FROM social_accounts sa JOIN clients c ON c.id=sa.client_id WHERE (?1 IS NULL OR sa.client_id=?1) ORDER BY c.name,sa.platform_id")?;
    let rows = stmt.query_map([client_id], |r| {
        Ok(SocialAccountRecord {
            id: r.get(0)?,
            client_id: r.get(1)?,
            client_name: r.get(2)?,
            platform: r.get(3)?,
            account_name: r.get(4)?,
            external_account_id: r.get(5)?,
            connection_status: r.get(6)?,
            token_expires_at: r.get(7)?,
            last_validated_at: r.get(8)?,
            mock_fail_next: r.get::<_, i64>(9)? == 1,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

fn supported_platform(platform: &str) -> bool {
    ["instagram", "facebook", "linkedin", "youtube"].contains(&platform)
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    })
}

fn default_token_endpoint(platform: &str) -> Option<String> {
    match platform {
        "youtube" => Some("https://oauth2.googleapis.com/token".into()),
        "linkedin" => Some("https://www.linkedin.com/oauth/v2/accessToken".into()),
        _ => None,
    }
}

fn official_adapter_for_input(
    input: &OfficialConnectionInput,
) -> Result<Box<dyn PlatformAdapter>, AppError> {
    official_adapter(
        &input.platform,
        input.access_token.trim().into(),
        input.external_account_id.trim().into(),
        input.settings.clone(),
    )
    .map_err(AppError::Validation)
}

pub fn connect_official_account(
    database: &Database,
    input: OfficialConnectionInput,
) -> Result<String, AppError> {
    if !supported_platform(&input.platform) {
        return Err(AppError::Validation("Unsupported official platform".into()));
    }
    if input.client_id.trim().is_empty()
        || input.account_name.trim().is_empty()
        || input.external_account_id.trim().is_empty()
        || input.access_token.trim().is_empty()
    {
        return Err(AppError::Validation(
            "Client, account name, platform account ID and access token are required".into(),
        ));
    }
    let client_exists = database
        .connection
        .lock()
        .expect("database lock poisoned")
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM clients WHERE id=?1 AND archived_at IS NULL)",
            [&input.client_id],
            |row| row.get::<_, bool>(0),
        )?;
    if !client_exists {
        return Err(AppError::NotFound("Client not found".into()));
    }

    official_adapter_for_input(&input)?
        .connect()
        .map_err(AppError::Validation)?;

    let now = Utc::now().to_rfc3339();
    let existing: Option<String> = database
        .connection
        .lock()
        .expect("database lock poisoned")
        .query_row(
            "SELECT id FROM social_accounts WHERE client_id=?1 AND platform_id=?2 AND external_account_id=?3 LIMIT 1",
            params![input.client_id, input.platform, input.external_account_id],
            |row| row.get(0),
        )
        .optional()?;
    let id = existing.unwrap_or_else(|| Uuid::new_v4().to_string());
    let storage_key = format!("social-account:{id}");
    let credential = OAuthCredentialBundle {
        access_token: input.access_token.trim().into(),
        refresh_token: optional_trimmed(input.refresh_token),
        expires_at: optional_trimmed(input.token_expires_at.clone()),
        token_endpoint: optional_trimmed(input.token_endpoint)
            .or_else(|| default_token_endpoint(&input.platform)),
        client_id: optional_trimmed(input.oauth_client_id),
        client_secret: optional_trimmed(input.oauth_client_secret),
    };
    if credential.refresh_token.is_some() && credential.client_id.is_none() {
        return Err(AppError::Validation(
            "OAuth client ID is required when a refresh token is supplied".into(),
        ));
    }
    crate::security::store_oauth_credentials(&storage_key, &credential)?;
    let settings = match input.settings {
        Value::Object(mut map) => {
            map.insert("mode".into(), Value::String("official".into()));
            Value::Object(map)
        }
        _ => json!({"mode":"official"}),
    };
    let connection = database.connection.lock().expect("database lock poisoned");
    connection.execute(
        "INSERT INTO social_accounts(id,client_id,platform_id,account_name,external_account_id,connection_status,auth_storage_key,token_expires_at,last_validated_at,settings,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,'connected',?6,?7,?8,?9,?8,?8) ON CONFLICT(id) DO UPDATE SET account_name=excluded.account_name,external_account_id=excluded.external_account_id,connection_status='connected',auth_storage_key=excluded.auth_storage_key,token_expires_at=excluded.token_expires_at,last_validated_at=excluded.last_validated_at,settings=excluded.settings,updated_at=excluded.updated_at",
        params![id, input.client_id, input.platform, input.account_name.trim(), input.external_account_id.trim(), storage_key, input.token_expires_at, now, settings.to_string()],
    )?;
    connection.execute(
        "INSERT INTO activity_logs(id,client_id,entity_type,entity_id,action,summary,metadata) VALUES(?1,?2,'social_account',?3,'connected',?4,?5)",
        params![Uuid::new_v4().to_string(), input.client_id, id, format!("Official {} account connected", input.platform), json!({"platform":input.platform,"external_account_id":input.external_account_id}).to_string()],
    )?;
    Ok(id)
}

pub fn validate_account(database: &Database, account_id: &str) -> Result<(), AppError> {
    let record: Option<(String, String, String, String)> = database
        .connection
        .lock()
        .expect("database lock poisoned")
        .query_row(
            "SELECT platform_id,external_account_id,auth_storage_key,settings FROM social_accounts WHERE id=?1 AND connection_status='connected'",
            [account_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()?;
    let (platform, external_id, storage_key, settings) = record.ok_or_else(|| {
        AppError::Validation("Only an officially connected account can be validated".into())
    })?;
    let token = crate::security::read_oauth_token(&storage_key)?;
    let adapter = official_adapter(
        &platform,
        token,
        external_id,
        serde_json::from_str(&settings).unwrap_or_else(|_| json!({})),
    )
    .map_err(AppError::Validation)?;
    let valid = adapter
        .validate_connection()
        .map_err(AppError::Validation)?;
    if !valid {
        return Err(AppError::Validation(
            "The platform rejected this account authorization".into(),
        ));
    }
    database.connection.lock().expect("database lock poisoned").execute(
        "UPDATE social_accounts SET last_validated_at=?2,connection_status='connected',updated_at=?2 WHERE id=?1",
        params![account_id, Utc::now().to_rfc3339()],
    )?;
    Ok(())
}
pub fn connect_mock_account(
    database: &Database,
    client_id: &str,
    platform: &str,
    account_name: &str,
) -> Result<String, AppError> {
    if !["instagram", "facebook", "linkedin", "youtube"].contains(&platform) {
        return Err(AppError::Validation("Unsupported platform".into()));
    }
    let now = Utc::now().to_rfc3339();
    let connection = database.connection.lock().expect("database lock poisoned");
    let client: Option<String> = connection
        .query_row(
            "SELECT name FROM clients WHERE id=?1 AND archived_at IS NULL",
            [client_id],
            |r| r.get(0),
        )
        .optional()?;
    let client = client.ok_or_else(|| AppError::NotFound("Client not found".into()))?;
    let existing:Option<String>=connection.query_row("SELECT id FROM social_accounts WHERE client_id=?1 AND platform_id=?2 AND connection_status='mock' LIMIT 1",params![client_id,platform],|r|r.get(0)).optional()?;
    if let Some(id) = existing {
        connection.execute("UPDATE social_accounts SET account_name=?2,connection_status='mock',last_validated_at=?3,updated_at=?3 WHERE id=?1",params![id,account_name,now])?;
        return Ok(id);
    }
    let id = Uuid::new_v4().to_string();
    connection.execute("INSERT INTO social_accounts(id,client_id,platform_id,account_name,external_account_id,connection_status,last_validated_at,settings,created_at,updated_at)VALUES(?1,?2,?3,?4,?5,'mock',?6,'{\"mode\":\"mock\"}',?6,?6)",params![id,client_id,platform,if account_name.trim().is_empty(){format!("{client} Mock")}else{account_name.trim().into()},format!("mock-{id}"),now])?;
    Ok(id)
}
pub fn disconnect_account(database: &Database, account_id: &str) -> Result<(), AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let storage_key: Option<String> = connection
        .query_row(
            "SELECT auth_storage_key FROM social_accounts WHERE id=?1",
            [account_id],
            |row| row.get(0),
        )
        .optional()?
        .flatten();
    let changed = connection.execute(
        "UPDATE social_accounts SET connection_status='disconnected',auth_storage_key=NULL,token_expires_at=NULL,updated_at=?2 WHERE id=?1",
        params![account_id, Utc::now().to_rfc3339()],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("Social account not found".into()));
    }
    drop(connection);
    if let Some(storage_key) = storage_key {
        let _ = crate::security::delete_oauth_token(&storage_key);
    }
    crate::automation::add_notification(
        database,
        "account_disconnected",
        "Social account disconnected",
        "Publishing is paused for this local account until it is reconnected",
        "social_account",
        account_id,
    )?;
    Ok(())
}
pub fn set_mock_failure(
    database: &Database,
    account_id: &str,
    fail_next: bool,
) -> Result<(), AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let changed=connection.execute("UPDATE social_accounts SET settings=json_set(settings,'$.fail_next',?2),updated_at=?3 WHERE id=?1 AND connection_status='mock'",params![account_id,fail_next,Utc::now().to_rfc3339()])?;
    if changed == 0 {
        return Err(AppError::Validation(
            "Failure simulation is available only for Mock Connected accounts".into(),
        ));
    }
    Ok(())
}
