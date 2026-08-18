use std::{fs, path::Path};

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{database::Database, error::AppError};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInput {
    pub client_name: String,
    pub company_name: String,
    pub brand_name: String,
    pub industry: String,
    pub website: String,
    pub location: String,
    pub business_description: String,
    #[serde(default)]
    pub products: Vec<String>,
    #[serde(default)]
    pub services: Vec<String>,
    pub target_audience: String,
    #[serde(default)]
    pub marketing_goals: Vec<String>,
    #[serde(default)]
    pub competitors: Vec<String>,
    pub posting_frequency: String,
    #[serde(default)]
    pub main_platforms: Vec<String>,
    pub status: String,
    pub brand_voice: String,
    #[serde(default)]
    pub brand_personality: Vec<String>,
    #[serde(default)]
    pub brand_colours: Vec<String>,
    #[serde(default)]
    pub fonts: Vec<String>,
    pub preferred_cta: String,
    pub content_style: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub topics_to_avoid: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientSummary {
    pub id: String,
    pub client_name: String,
    pub brand_name: String,
    pub industry: String,
    pub location: String,
    pub social_account_count: i64,
    pub scheduled_post_count: i64,
    pub status: String,
    pub last_activity: String,
    pub logo_path: Option<String>,
    pub main_platforms: Vec<String>,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientStats {
    pub draft_posts: i64,
    pub approved_posts: i64,
    pub scheduled_posts: i64,
    pub published_posts: i64,
    pub connected_platforms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandProfileRecord {
    pub brand_voice: String,
    pub brand_personality: Vec<String>,
    pub brand_colours: Vec<String>,
    pub fonts: Vec<String>,
    pub primary_audience: String,
    pub preferred_cta: String,
    pub content_style: String,
    pub keywords: Vec<String>,
    pub topics_to_avoid: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientDetail {
    pub id: String,
    pub client_name: String,
    pub company_name: String,
    pub brand_name: String,
    pub industry: String,
    pub website: String,
    pub location: String,
    pub business_description: String,
    pub products: Vec<String>,
    pub services: Vec<String>,
    pub target_audience: String,
    pub marketing_goals: Vec<String>,
    pub competitors: Vec<String>,
    pub posting_frequency: String,
    pub main_platforms: Vec<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
    pub logo_path: Option<String>,
    pub brand_profile: BrandProfileRecord,
    pub stats: ClientStats,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoUpload {
    pub client_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
}

fn json<T: Serialize>(value: &T) -> Result<String, AppError> {
    serde_json::to_string(value).map_err(AppError::Json)
}

fn parse_vec(value: String) -> Vec<String> {
    serde_json::from_str(&value).unwrap_or_default()
}

fn parse_json_string(value: String) -> String {
    serde_json::from_str(&value).unwrap_or(value)
}

fn required_name(value: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("Client name is required".into()));
    }
    if trimmed.len() > 120 {
        return Err(AppError::Validation(
            "Client name must be 120 characters or fewer".into(),
        ));
    }
    Ok(trimmed.to_owned())
}

fn normalise_status(value: &str) -> Result<&str, AppError> {
    match value {
        "active" | "paused" => Ok(value),
        _ => Err(AppError::Validation("Invalid client status".into())),
    }
}

fn activity(
    transaction: &rusqlite::Transaction<'_>,
    client_id: &str,
    action: &str,
    summary: &str,
) -> Result<(), AppError> {
    transaction.execute(
        "INSERT INTO activity_logs (id, client_id, entity_type, entity_id, action, summary) VALUES (?1, ?2, 'client', ?2, ?3, ?4)",
        params![Uuid::new_v4().to_string(), client_id, action, summary],
    )?;
    Ok(())
}

pub fn list_clients(
    database: &Database,
    search: Option<String>,
    filter: Option<String>,
    sort: Option<String>,
) -> Result<Vec<ClientSummary>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let filter_sql = match filter.as_deref().unwrap_or("active") {
        "all" => "1 = 1",
        "archived" => "c.archived_at IS NOT NULL",
        "paused" => "c.archived_at IS NULL AND c.status = 'paused'",
        _ => "c.archived_at IS NULL AND c.status = 'active'",
    };
    let order_sql = match sort.as_deref().unwrap_or("recent") {
        "name" => "c.name COLLATE NOCASE ASC",
        "industry" => "c.industry COLLATE NOCASE ASC, c.name COLLATE NOCASE ASC",
        "oldest" => "c.created_at ASC",
        _ => "last_activity DESC",
    };
    let search_pattern = format!("%{}%", search.unwrap_or_default().trim());
    let sql = format!(
        "SELECT c.id, c.name, COALESCE(NULLIF(c.brand_name, ''), NULLIF(c.company_name, ''), c.name),
                COALESCE(c.industry, ''), COALESCE(c.location, ''),
                (SELECT COUNT(*) FROM social_accounts sa WHERE sa.client_id = c.id),
                (SELECT COUNT(*) FROM schedules s JOIN post_versions pv ON pv.id = s.post_version_id JOIN posts p ON p.id = pv.post_id WHERE p.client_id = c.id AND s.status IN ('pending', 'queued', 'processing')),
                CASE WHEN c.archived_at IS NOT NULL THEN 'archived' ELSE c.status END,
                COALESCE((SELECT MAX(al.created_at) FROM activity_logs al WHERE al.client_id = c.id), c.updated_at) AS last_activity,
                m.relative_path, c.main_platforms
         FROM clients c
         LEFT JOIN brand_profiles bp ON bp.client_id = c.id
         LEFT JOIN media m ON m.id = bp.logo_media_id
         WHERE {filter_sql}
           AND (?1 = '%%' OR c.name LIKE ?1 OR c.company_name LIKE ?1 OR c.brand_name LIKE ?1 OR c.industry LIKE ?1)
         ORDER BY {order_sql}"
    );
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map([search_pattern], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, String>(7)?,
            row.get::<_, String>(8)?,
            row.get::<_, Option<String>>(9)?,
            row.get::<_, String>(10)?,
        ))
    })?;

    rows.map(|row| {
        let (
            id,
            client_name,
            brand_name,
            industry,
            location,
            accounts,
            scheduled,
            status,
            last_activity,
            logo,
            platforms,
        ) = row?;
        Ok(ClientSummary {
            id,
            client_name,
            brand_name,
            industry,
            location,
            social_account_count: accounts,
            scheduled_post_count: scheduled,
            status,
            last_activity,
            logo_path: logo.map(|path| {
                database
                    .app_data_dir
                    .join(path)
                    .to_string_lossy()
                    .to_string()
            }),
            main_platforms: parse_vec(platforms),
        })
    })
    .collect()
}

pub fn create_client(database: &Database, input: ClientInput) -> Result<String, AppError> {
    let name = required_name(&input.client_name)?;
    let status = normalise_status(&input.status)?;
    let client_id = Uuid::new_v4().to_string();
    let profile_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;

    transaction.execute(
        "INSERT INTO clients (id, name, company_name, brand_name, industry, location, website, business_description, products, services, target_audience, marketing_goals, competitors, preferred_content, posting_frequency, main_platforms, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18)",
        params![
            client_id, name, input.company_name.trim(), input.brand_name.trim(), input.industry.trim(), input.location.trim(), input.website.trim(), input.business_description.trim(),
            json(&input.products)?, json(&input.services)?, input.target_audience.trim(), json(&input.marketing_goals)?, json(&input.competitors)?, json(&vec![input.content_style.trim()])?,
            json(&input.posting_frequency.trim())?, json(&input.main_platforms)?, status, now,
        ],
    )?;
    transaction.execute(
        "INSERT INTO brand_profiles (id, client_id, brand_voice, brand_personality, primary_audience, main_offering, preferred_cta, avoid_topics, brand_colours, content_style, keywords, fonts, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            profile_id, client_id, input.brand_voice.trim(), json(&input.brand_personality)?, input.target_audience.trim(), input.services.first().or(input.products.first()).cloned().unwrap_or_default(),
            input.preferred_cta.trim(), json(&input.topics_to_avoid)?, json(&input.brand_colours)?, input.content_style.trim(), json(&input.keywords)?, json(&input.fonts)?, now,
        ],
    )?;
    activity(
        &transaction,
        &client_id,
        "created",
        &format!("Client {name} created"),
    )?;
    transaction.commit()?;
    Ok(client_id)
}

pub fn update_client(
    database: &Database,
    client_id: &str,
    input: ClientInput,
) -> Result<(), AppError> {
    let name = required_name(&input.client_name)?;
    let status = normalise_status(&input.status)?;
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;
    let changed = transaction.execute(
        "UPDATE clients SET name=?2, company_name=?3, brand_name=?4, industry=?5, location=?6, website=?7, business_description=?8, products=?9, services=?10, target_audience=?11, marketing_goals=?12, competitors=?13, preferred_content=?14, posting_frequency=?15, main_platforms=?16, status=?17, updated_at=?18 WHERE id=?1",
        params![client_id, name, input.company_name.trim(), input.brand_name.trim(), input.industry.trim(), input.location.trim(), input.website.trim(), input.business_description.trim(), json(&input.products)?, json(&input.services)?, input.target_audience.trim(), json(&input.marketing_goals)?, json(&input.competitors)?, json(&vec![input.content_style.trim()])?, json(&input.posting_frequency.trim())?, json(&input.main_platforms)?, status, now],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("Client not found".into()));
    }
    transaction.execute(
        "INSERT INTO brand_profiles (id, client_id, brand_voice, brand_personality, primary_audience, main_offering, preferred_cta, avoid_topics, brand_colours, content_style, keywords, fonts, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(client_id) DO UPDATE SET brand_voice=excluded.brand_voice, brand_personality=excluded.brand_personality, primary_audience=excluded.primary_audience, main_offering=excluded.main_offering, preferred_cta=excluded.preferred_cta, avoid_topics=excluded.avoid_topics, brand_colours=excluded.brand_colours, content_style=excluded.content_style, keywords=excluded.keywords, fonts=excluded.fonts, updated_at=excluded.updated_at",
        params![Uuid::new_v4().to_string(), client_id, input.brand_voice.trim(), json(&input.brand_personality)?, input.target_audience.trim(), input.services.first().or(input.products.first()).cloned().unwrap_or_default(), input.preferred_cta.trim(), json(&input.topics_to_avoid)?, json(&input.brand_colours)?, input.content_style.trim(), json(&input.keywords)?, json(&input.fonts)?, now],
    )?;
    activity(
        &transaction,
        client_id,
        "updated",
        &format!("Client {name} updated"),
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn get_client(database: &Database, client_id: &str) -> Result<ClientDetail, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let result = connection.query_row(
        "SELECT c.id, c.name, COALESCE(c.company_name,''), COALESCE(c.brand_name,''), COALESCE(c.industry,''), COALESCE(c.website,''), COALESCE(c.location,''), COALESCE(c.business_description,''), c.products, c.services, COALESCE(c.target_audience,''), c.marketing_goals, c.competitors, c.posting_frequency, c.main_platforms, CASE WHEN c.archived_at IS NOT NULL THEN 'archived' ELSE c.status END, c.created_at, c.updated_at, c.archived_at,
                COALESCE(bp.brand_voice,''), COALESCE(bp.brand_personality,'[]'), COALESCE(bp.brand_colours,'[]'), COALESCE(bp.fonts,'[]'), COALESCE(bp.primary_audience,''), COALESCE(bp.preferred_cta,''), COALESCE(bp.content_style,''), COALESCE(bp.keywords,'[]'), COALESCE(bp.avoid_topics,'[]'), m.relative_path
         FROM clients c LEFT JOIN brand_profiles bp ON bp.client_id=c.id LEFT JOIN media m ON m.id=bp.logo_media_id WHERE c.id=?1",
        [client_id],
        |row| Ok((
            row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?, row.get::<_, String>(5)?, row.get::<_, String>(6)?, row.get::<_, String>(7)?, row.get::<_, String>(8)?, row.get::<_, String>(9)?, row.get::<_, String>(10)?, row.get::<_, String>(11)?, row.get::<_, String>(12)?, row.get::<_, String>(13)?, row.get::<_, String>(14)?, row.get::<_, String>(15)?, row.get::<_, String>(16)?, row.get::<_, String>(17)?, row.get::<_, Option<String>>(18)?, row.get::<_, String>(19)?, row.get::<_, String>(20)?, row.get::<_, String>(21)?, row.get::<_, String>(22)?, row.get::<_, String>(23)?, row.get::<_, String>(24)?, row.get::<_, String>(25)?, row.get::<_, String>(26)?, row.get::<_, String>(27)?, row.get::<_, Option<String>>(28)?,
        )),
    ).optional()?;
    let row = result.ok_or_else(|| AppError::NotFound("Client not found".into()))?;
    let stats = ClientStats {
        draft_posts: connection.query_row("SELECT COUNT(*) FROM posts WHERE client_id=?1 AND status='draft'", [client_id], |r| r.get(0))?,
        approved_posts: connection.query_row("SELECT COUNT(*) FROM posts WHERE client_id=?1 AND status='approved'", [client_id], |r| r.get(0))?,
        scheduled_posts: connection.query_row("SELECT COUNT(*) FROM posts WHERE client_id=?1 AND status='scheduled'", [client_id], |r| r.get(0))?,
        published_posts: connection.query_row("SELECT COUNT(*) FROM posts WHERE client_id=?1 AND status='published'", [client_id], |r| r.get(0))?,
        connected_platforms: connection.query_row("SELECT COUNT(*) FROM social_accounts WHERE client_id=?1 AND connection_status IN ('connected','mock')", [client_id], |r| r.get(0))?,
    };
    Ok(ClientDetail {
        id: row.0,
        client_name: row.1,
        company_name: row.2,
        brand_name: row.3,
        industry: row.4,
        website: row.5,
        location: row.6,
        business_description: row.7,
        products: parse_vec(row.8),
        services: parse_vec(row.9),
        target_audience: row.10,
        marketing_goals: parse_vec(row.11),
        competitors: parse_vec(row.12),
        posting_frequency: parse_json_string(row.13),
        main_platforms: parse_vec(row.14),
        status: row.15,
        created_at: row.16,
        updated_at: row.17,
        archived_at: row.18,
        brand_profile: BrandProfileRecord {
            brand_voice: row.19,
            brand_personality: parse_vec(row.20),
            brand_colours: parse_vec(row.21),
            fonts: parse_vec(row.22),
            primary_audience: row.23,
            preferred_cta: row.24,
            content_style: row.25,
            keywords: parse_vec(row.26),
            topics_to_avoid: parse_vec(row.27),
        },
        logo_path: row.28.map(|path| {
            database
                .app_data_dir
                .join(path)
                .to_string_lossy()
                .to_string()
        }),
        stats,
    })
}

pub fn archive_client(database: &Database, client_id: &str) -> Result<(), AppError> {
    set_archived(database, client_id, true)
}

pub fn restore_client(database: &Database, client_id: &str) -> Result<(), AppError> {
    set_archived(database, client_id, false)
}

fn set_archived(database: &Database, client_id: &str, archived: bool) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;
    let changed = if archived {
        transaction.execute(
            "UPDATE clients SET archived_at=?2, updated_at=?2 WHERE id=?1",
            params![client_id, now],
        )?
    } else {
        transaction.execute(
            "UPDATE clients SET archived_at=NULL, updated_at=?2 WHERE id=?1",
            params![client_id, now],
        )?
    };
    if changed == 0 {
        return Err(AppError::NotFound("Client not found".into()));
    }
    activity(
        &transaction,
        client_id,
        if archived { "archived" } else { "restored" },
        if archived {
            "Client archived"
        } else {
            "Client restored"
        },
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn delete_client(database: &Database, client_id: &str) -> Result<(), AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let changed = connection.execute("DELETE FROM clients WHERE id=?1", [client_id])?;
    drop(connection);
    if changed == 0 {
        return Err(AppError::NotFound("Client not found".into()));
    }
    let media_dir = database
        .app_data_dir
        .join("media")
        .join("clients")
        .join(client_id);
    if media_dir.exists() {
        fs::remove_dir_all(media_dir)?;
    }
    Ok(())
}

pub fn upload_client_logo(database: &Database, upload: LogoUpload) -> Result<String, AppError> {
    if !upload.mime_type.starts_with("image/") {
        return Err(AppError::Validation("Logo must be an image".into()));
    }
    if upload.bytes.is_empty() || upload.bytes.len() > 10 * 1024 * 1024 {
        return Err(AppError::Validation(
            "Logo must be between 1 byte and 10 MB".into(),
        ));
    }
    let extension = Path::new(&upload.file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();
    if !["png", "jpg", "jpeg", "webp", "gif"].contains(&extension.as_str()) {
        return Err(AppError::Validation("Unsupported logo file type".into()));
    }
    let client_exists = database
        .connection
        .lock()
        .expect("database lock poisoned")
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM clients WHERE id=?1)",
            [&upload.client_id],
            |row| row.get::<_, bool>(0),
        )?;
    if !client_exists {
        return Err(AppError::NotFound("Client not found".into()));
    }
    let relative = Path::new("media")
        .join("clients")
        .join(&upload.client_id)
        .join("logos")
        .join(format!("{}.{}", Uuid::new_v4(), extension));
    let absolute = database.app_data_dir.join(&relative);
    fs::create_dir_all(absolute.parent().expect("logo path has a parent"))?;
    fs::write(&absolute, &upload.bytes)?;

    let media_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let transaction = connection.transaction()?;
    let old_path: Option<String> = transaction.query_row("SELECT m.relative_path FROM brand_profiles bp LEFT JOIN media m ON m.id=bp.logo_media_id WHERE bp.client_id=?1", [&upload.client_id], |row| row.get(0)).optional()?.flatten();
    transaction.execute("INSERT INTO media (id, client_id, kind, file_name, relative_path, mime_type, file_size_bytes, created_at) VALUES (?1, ?2, 'logo', ?3, ?4, ?5, ?6, ?7)", params![media_id, upload.client_id, upload.file_name, relative.to_string_lossy(), upload.mime_type, upload.bytes.len() as i64, now])?;
    transaction.execute(
        "UPDATE brand_profiles SET logo_media_id=?2, updated_at=?3 WHERE client_id=?1",
        params![upload.client_id, media_id, now],
    )?;
    if let Some(path) = &old_path {
        transaction.execute("DELETE FROM media WHERE relative_path=?1", [path])?;
    }
    activity(
        &transaction,
        &upload.client_id,
        "logo_updated",
        "Client logo updated",
    )?;
    transaction.commit()?;
    if let Some(path) = old_path {
        let old_absolute = database.app_data_dir.join(path);
        if old_absolute.exists() {
            let _ = fs::remove_file(old_absolute);
        }
    }
    Ok(absolute.to_string_lossy().to_string())
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::database::Database;
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
            app_data_dir: std::env::temp_dir()
                .join(format!("socialflow-client-tests-{}", Uuid::new_v4())),
        }
    }

    pub(crate) fn input() -> ClientInput {
        ClientInput {
            client_name: "ABC Cafe".into(),
            company_name: "ABC Foods".into(),
            brand_name: "ABC Cafe".into(),
            industry: "Cafe".into(),
            website: "https://example.com".into(),
            location: "Surat".into(),
            business_description: "Neighbourhood cafe".into(),
            products: vec!["Coffee".into()],
            services: vec!["Dine-in".into()],
            target_audience: "Students".into(),
            marketing_goals: vec!["Store visits".into()],
            competitors: vec!["Local Cafe".into()],
            posting_frequency: "4 posts/week".into(),
            main_platforms: vec!["instagram".into(), "facebook".into()],
            status: "active".into(),
            brand_voice: "Friendly".into(),
            brand_personality: vec!["Energetic".into()],
            brand_colours: vec!["#6d4aff".into()],
            fonts: vec!["Inter".into()],
            preferred_cta: "Visit us".into(),
            content_style: "Food photography".into(),
            keywords: vec!["coffee".into()],
            topics_to_avoid: vec!["Formal language".into()],
        }
    }

    #[test]
    fn creates_updates_archives_and_deletes_a_client() {
        let db = database();
        let id = create_client(&db, input()).unwrap();
        let detail = get_client(&db, &id).unwrap();
        assert_eq!(detail.client_name, "ABC Cafe");
        assert_eq!(detail.brand_profile.brand_voice, "Friendly");

        let mut edited = input();
        edited.client_name = "ABC Coffee House".into();
        edited.brand_voice = "Warm and conversational".into();
        update_client(&db, &id, edited).unwrap();
        let edited_detail = get_client(&db, &id).unwrap();
        assert_eq!(edited_detail.client_name, "ABC Coffee House");
        assert_eq!(
            edited_detail.brand_profile.brand_voice,
            "Warm and conversational"
        );

        let logo_path = upload_client_logo(
            &db,
            LogoUpload {
                client_id: id.clone(),
                file_name: "brand.png".into(),
                mime_type: "image/png".into(),
                bytes: vec![137, 80, 78, 71],
            },
        )
        .unwrap();
        assert!(Path::new(&logo_path).exists());
        assert_eq!(
            get_client(&db, &id).unwrap().logo_path,
            Some(logo_path.clone())
        );
        assert_eq!(list_clients(&db, None, None, None).unwrap().len(), 1);
        archive_client(&db, &id).unwrap();
        assert_eq!(
            list_clients(&db, None, Some("archived".into()), None)
                .unwrap()
                .len(),
            1
        );
        restore_client(&db, &id).unwrap();
        delete_client(&db, &id).unwrap();
        assert!(!Path::new(&logo_path).exists());
        assert!(matches!(get_client(&db, &id), Err(AppError::NotFound(_))));
    }
}
