use std::{fs, path::Path};

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{database::Database, error::AppError};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaUpload {
    pub client_id: Option<String>,
    pub campaign_id: Option<String>,
    pub kind: String,
    pub file_name: String,
    pub mime_type: String,
    pub tags: Vec<String>,
    pub platforms: Vec<String>,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRecord {
    pub id: String,
    pub client_id: Option<String>,
    pub client_name: Option<String>,
    pub campaign_id: Option<String>,
    pub kind: String,
    pub file_name: String,
    pub absolute_path: String,
    pub mime_type: String,
    pub file_size_bytes: i64,
    pub tags: Vec<String>,
    pub platforms: Vec<String>,
    pub created_at: String,
}

fn safe_extension(file_name: &str, mime_type: &str) -> Result<String, AppError> {
    let allowed = [
        "jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "m4v", "pdf",
    ];
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !allowed.contains(&extension.as_str()) {
        return Err(AppError::Validation(
            "Use JPG, PNG, WebP, GIF, MP4, MOV, M4V or PDF media".into(),
        ));
    }
    if !(mime_type.starts_with("image/")
        || mime_type.starts_with("video/")
        || mime_type == "application/pdf")
    {
        return Err(AppError::Validation("Unsupported media MIME type".into()));
    }
    Ok(extension)
}

fn validate_kind(kind: &str) -> Result<(), AppError> {
    if [
        "image",
        "video",
        "logo",
        "brand_asset",
        "creative",
        "document",
    ]
    .contains(&kind)
    {
        Ok(())
    } else {
        Err(AppError::Validation("Unsupported media kind".into()))
    }
}

pub fn upload_media(database: &Database, upload: MediaUpload) -> Result<String, AppError> {
    validate_kind(&upload.kind)?;
    if upload.bytes.is_empty() || upload.bytes.len() > 500 * 1024 * 1024 {
        return Err(AppError::Validation(
            "Media must be between 1 byte and 500 MB".into(),
        ));
    }
    let extension = safe_extension(&upload.file_name, &upload.mime_type)?;
    let owner = upload.client_id.as_deref().unwrap_or("shared");
    let folder = match upload.kind.as_str() {
        "video" => "videos",
        "logo" => "logos",
        "creative" => "generated",
        _ => "uploads",
    };
    let relative = Path::new("media")
        .join("clients")
        .join(owner)
        .join(folder)
        .join(format!("{}.{}", Uuid::new_v4(), extension));
    let absolute = database.app_data_dir.join(&relative);
    fs::create_dir_all(absolute.parent().expect("media path parent"))?;
    fs::write(&absolute, &upload.bytes)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let connection = database.connection.lock().expect("database lock poisoned");
    if let Some(client_id) = upload.client_id.as_deref() {
        let exists: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM clients WHERE id=?1 AND archived_at IS NULL)",
            [client_id],
            |row| row.get(0),
        )?;
        if !exists {
            let _ = fs::remove_file(&absolute);
            return Err(AppError::NotFound("Client not found".into()));
        }
    }
    if let Err(error) = connection.execute("INSERT INTO media (id,client_id,campaign_id,kind,file_name,relative_path,mime_type,file_size_bytes,tags,platform_ids,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)",params![id,upload.client_id,upload.campaign_id,upload.kind,upload.file_name,relative.to_string_lossy(),upload.mime_type,upload.bytes.len() as i64,serde_json::to_string(&upload.tags)?,serde_json::to_string(&upload.platforms)?,now]) {
        let _ = fs::remove_file(&absolute); return Err(error.into());
    }
    Ok(id)
}

pub fn list_media(
    database: &Database,
    client_id: Option<String>,
    kind: Option<String>,
    search: Option<String>,
) -> Result<Vec<MediaRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let pattern = format!("%{}%", search.unwrap_or_default().trim());
    let mut statement = connection.prepare("SELECT m.id,m.client_id,c.name,m.campaign_id,m.kind,m.file_name,m.relative_path,COALESCE(m.mime_type,''),COALESCE(m.file_size_bytes,0),m.tags,m.platform_ids,m.created_at FROM media m LEFT JOIN clients c ON c.id=m.client_id WHERE m.deleted_at IS NULL AND (?1 IS NULL OR m.client_id=?1) AND (?2 IS NULL OR ?2='all' OR m.kind=?2) AND (?3='%%' OR m.file_name LIKE ?3 OR m.tags LIKE ?3) ORDER BY m.created_at DESC LIMIT 500")?;
    let rows = statement.query_map(params![client_id, kind, pattern], |row| {
        let relative: String = row.get(6)?;
        let tags: String = row.get(9)?;
        let platforms: String = row.get(10)?;
        Ok(MediaRecord {
            id: row.get(0)?,
            client_id: row.get(1)?,
            client_name: row.get(2)?,
            campaign_id: row.get(3)?,
            kind: row.get(4)?,
            file_name: row.get(5)?,
            absolute_path: database
                .app_data_dir
                .join(relative)
                .to_string_lossy()
                .into(),
            mime_type: row.get(7)?,
            file_size_bytes: row.get(8)?,
            tags: serde_json::from_str(&tags).unwrap_or_default(),
            platforms: serde_json::from_str(&platforms).unwrap_or_default(),
            created_at: row.get(11)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn rename_media(database: &Database, media_id: &str, file_name: &str) -> Result<(), AppError> {
    if file_name.trim().is_empty()
        || file_name.chars().count() > 255
        || file_name.contains('/')
        || file_name.contains('\\')
    {
        return Err(AppError::Validation(
            "Enter a safe file name under 256 characters".into(),
        ));
    }
    let connection = database.connection.lock().expect("database lock poisoned");
    let changed = connection.execute(
        "UPDATE media SET file_name=?2,updated_at=?3 WHERE id=?1 AND deleted_at IS NULL",
        params![media_id, file_name.trim(), Utc::now().to_rfc3339()],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("Media not found".into()));
    }
    Ok(())
}

pub fn delete_media(database: &Database, media_id: &str) -> Result<(), AppError> {
    let mut connection = database.connection.lock().expect("database lock poisoned");
    let tx = connection.transaction()?;
    let relative: Option<String> = tx
        .query_row(
            "SELECT relative_path FROM media WHERE id=?1 AND deleted_at IS NULL",
            [media_id],
            |row| row.get(0),
        )
        .optional()?;
    let relative = relative.ok_or_else(|| AppError::NotFound("Media not found".into()))?;
    let attached: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM post_media WHERE media_id=?1)",
        [media_id],
        |row| row.get(0),
    )?;
    if attached {
        return Err(AppError::Validation(
            "Detach this media from posts before deleting it".into(),
        ));
    }
    tx.execute(
        "UPDATE media SET deleted_at=?2,updated_at=?2 WHERE id=?1",
        params![media_id, Utc::now().to_rfc3339()],
    )?;
    tx.commit()?;
    let path = database.app_data_dir.join(relative);
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

pub fn list_attached_media_ids(
    database: &Database,
    post_id: &str,
    platform: &str,
) -> Result<Vec<String>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut statement = connection.prepare(
        "SELECT pm.media_id FROM post_media pm JOIN post_versions pv ON pv.id=pm.post_version_id WHERE pv.post_id=?1 AND pv.platform_id=?2 ORDER BY pm.sort_order,pm.media_id",
    )?;
    let rows = statement.query_map(params![post_id, platform], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn attach_media(
    database: &Database,
    post_id: &str,
    platform: &str,
    media_id: &str,
) -> Result<(), AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let version: Option<(String, String)> = connection.query_row(
        "SELECT pv.id,p.client_id FROM post_versions pv JOIN posts p ON p.id=pv.post_id WHERE p.id=?1 AND pv.platform_id=?2 AND p.status IN('draft','rejected','paused') AND p.deleted_at IS NULL",
        params![post_id, platform],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional()?;
    let (version_id, client_id) = version.ok_or_else(|| {
        AppError::Validation(
            "Save an editable draft with this platform before attaching media".into(),
        )
    })?;
    let allowed: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM media WHERE id=?1 AND deleted_at IS NULL AND (client_id IS NULL OR client_id=?2))",
        params![media_id, client_id],
        |row| row.get(0),
    )?;
    if !allowed {
        return Err(AppError::Validation(
            "Choose media owned by this client or shared media".into(),
        ));
    }
    connection.execute(
        "INSERT OR IGNORE INTO post_media(post_version_id,media_id,sort_order,role) VALUES(?1,?2,(SELECT COUNT(*) FROM post_media WHERE post_version_id=?1),'primary')",
        params![version_id, media_id],
    )?;
    Ok(())
}

pub fn detach_media(
    database: &Database,
    post_id: &str,
    platform: &str,
    media_id: &str,
) -> Result<(), AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    connection.execute(
        "DELETE FROM post_media WHERE media_id=?3 AND post_version_id IN(SELECT id FROM post_versions WHERE post_id=?1 AND platform_id=?2)",
        params![post_id, platform, media_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{clients, content_studio, database::Database};
    use rusqlite::Connection;
    use std::sync::Mutex;
    #[test]
    fn uploads_lists_renames_and_deletes_local_media() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        let app_data_dir =
            std::env::temp_dir().join(format!("socialflow-media-{}", Uuid::new_v4()));
        let database = Database {
            connection: Mutex::new(connection),
            app_data_dir: app_data_dir.clone(),
        };
        let client_id = clients::create_client(&database, clients::tests::input()).unwrap();
        let id = upload_media(
            &database,
            MediaUpload {
                client_id: Some(client_id.clone()),
                campaign_id: None,
                kind: "image".into(),
                file_name: "coffee.png".into(),
                mime_type: "image/png".into(),
                tags: vec!["coffee".into()],
                platforms: vec!["instagram".into()],
                bytes: vec![137, 80, 78, 71],
            },
        )
        .unwrap();
        assert_eq!(
            list_media(&database, Some(client_id.clone()), None, None)
                .unwrap()
                .len(),
            1
        );
        let post_id =
            content_studio::save_post(&database, None, content_studio::tests::input(client_id))
                .unwrap();
        attach_media(&database, &post_id, "instagram", &id).unwrap();
        assert_eq!(
            list_attached_media_ids(&database, &post_id, "instagram").unwrap(),
            vec![id.clone()]
        );
        assert!(delete_media(&database, &id).is_err());
        detach_media(&database, &post_id, "instagram", &id).unwrap();
        rename_media(&database, &id, "weekend.png").unwrap();
        delete_media(&database, &id).unwrap();
        assert!(list_media(&database, None, None, None).unwrap().is_empty());
        let _ = fs::remove_dir_all(app_data_dir);
    }
}
