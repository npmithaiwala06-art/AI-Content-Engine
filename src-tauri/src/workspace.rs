use crate::{database::Database, error::AppError};
use chrono::{Local, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub kind: String,
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub path: String,
    pub status: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityRecord {
    pub id: String,
    pub client_id: Option<String>,
    pub client_name: Option<String>,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub action: String,
    pub summary: String,
    pub metadata: serde_json::Value,
    pub created_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingRecord {
    pub key: String,
    pub value: serde_json::Value,
    pub category: String,
    pub updated_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub name: String,
    pub path: String,
    pub has_database: bool,
    pub has_media: bool,
    pub created_at: String,
}

pub fn universal_search(database: &Database, query: &str) -> Result<Vec<SearchResult>, AppError> {
    if query.trim().chars().count() < 2 {
        return Ok(vec![]);
    }
    let pattern = format!("%{}%", query.trim());
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut out = Vec::new();
    macro_rules! collect {
        ($sql:expr,$kind:expr,$path:expr) => {{
            let mut stmt = connection.prepare($sql)?;
            let rows = stmt.query_map([&pattern], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })?;
            for row in rows {
                let (id, title, subtitle, status) = row?;
                out.push(SearchResult {
                    kind: $kind.into(),
                    id: id.clone(),
                    title,
                    subtitle,
                    path: format!($path, id),
                    status,
                });
            }
        }};
    }
    collect!("SELECT id,name,COALESCE(brand_name,industry,''),CASE WHEN archived_at IS NULL THEN status ELSE 'archived' END FROM clients WHERE name LIKE ?1 OR brand_name LIKE ?1 OR industry LIKE ?1 LIMIT 8","client","/clients/{}");
    collect!("SELECT id,COALESCE(title,''),COALESCE(core_idea,''),status FROM posts WHERE deleted_at IS NULL AND(title LIKE ?1 OR core_idea LIKE ?1) LIMIT 8","post","/create?post={}");
    collect!("SELECT id,name,COALESCE(objective,''),status FROM campaigns WHERE name LIKE ?1 OR objective LIKE ?1 LIMIT 8","campaign","/campaigns?campaign={}");
    collect!("SELECT id,file_name,kind,kind FROM media WHERE deleted_at IS NULL AND(file_name LIKE ?1 OR tags LIKE ?1) LIMIT 8","media","/media?asset={}");
    collect!("SELECT r.id,c.name||' '||r.report_type||' report',r.period_start||' to '||r.period_end,r.status FROM reports r JOIN clients c ON c.id=r.client_id WHERE c.name LIKE ?1 OR r.report_type LIKE ?1 LIMIT 8","report","/reports?report={}");
    Ok(out)
}
pub fn list_activity(
    database: &Database,
    client_id: Option<String>,
    action: Option<String>,
    limit: i64,
) -> Result<Vec<ActivityRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT a.id,a.client_id,c.name,a.entity_type,a.entity_id,a.action,a.summary,a.metadata,a.created_at FROM activity_logs a LEFT JOIN clients c ON c.id=a.client_id WHERE(?1 IS NULL OR a.client_id=?1)AND(?2 IS NULL OR ?2='all' OR a.action=?2)ORDER BY a.created_at DESC LIMIT ?3")?;
    let rows = stmt.query_map(params![client_id, action, limit.clamp(1, 1000)], |r| {
        let metadata: String = r.get(7)?;
        Ok(ActivityRecord {
            id: r.get(0)?,
            client_id: r.get(1)?,
            client_name: r.get(2)?,
            entity_type: r.get(3)?,
            entity_id: r.get(4)?,
            action: r.get(5)?,
            summary: r.get(6)?,
            metadata: serde_json::from_str(&metadata).unwrap_or_default(),
            created_at: r.get(8)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
pub fn list_settings(database: &Database) -> Result<Vec<SettingRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt = connection
        .prepare("SELECT key,value,category,updated_at FROM settings ORDER BY category,key")?;
    let rows = stmt.query_map([], |r| {
        let value: String = r.get(1)?;
        Ok(SettingRecord {
            key: r.get(0)?,
            value: serde_json::from_str(&value).unwrap_or(serde_json::Value::Null),
            category: r.get(2)?,
            updated_at: r.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
pub fn update_setting(
    database: &Database,
    key: &str,
    value: serde_json::Value,
) -> Result<(), AppError> {
    let allowed = [
        "publishing.mock_mode",
        "approval.autopilot_enabled",
        "privacy.ai_api_enabled",
        "scheduler.max_retries",
        "scheduler.enabled",
        "scheduler.interval_seconds",
        "notifications.enabled",
        "appearance.theme",
        "general.first_run_complete",
    ];
    if !allowed.contains(&key) {
        return Err(AppError::Validation(
            "This setting cannot be changed here".into(),
        ));
    }
    if key == "privacy.ai_api_enabled" && value != serde_json::Value::Bool(false) {
        return Err(AppError::Validation(
            "AI API access is disabled by product policy".into(),
        ));
    }
    let category = key.split('.').next().unwrap_or("general");
    database.connection.lock().expect("database lock poisoned").execute("INSERT INTO settings(key,value,category,updated_at)VALUES(?1,?2,?3,?4)ON CONFLICT(key)DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",params![key,value.to_string(),category,Utc::now().to_rfc3339()])?;
    Ok(())
}
fn copy_tree(source: &Path, dest: &Path) -> Result<(), std::io::Error> {
    if !source.exists() {
        return Ok(());
    }
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let target = dest.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}
pub fn create_backup(
    database: &Database,
    kind: &str,
    destination: Option<String>,
) -> Result<BackupRecord, AppError> {
    if !["database", "media", "full"].contains(&kind) {
        return Err(AppError::Validation(
            "Backup type must be database, media or full".into(),
        ));
    }
    let stamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let base = destination
        .map(PathBuf::from)
        .unwrap_or_else(|| database.app_data_dir.join("backups"));
    fs::create_dir_all(&base)?;
    let folder = base.join(format!("socialflow-{kind}-{stamp}"));
    fs::create_dir_all(&folder)?;
    if kind != "media" {
        let db_path = folder.join("socialflow.sqlite");
        database
            .connection
            .lock()
            .expect("database lock poisoned")
            .execute("VACUUM INTO ?1", [db_path.to_string_lossy().as_ref()])?;
    }
    if kind != "database" {
        copy_tree(&database.app_data_dir.join("media"), &folder.join("media"))?;
    }
    fs::write(
        folder.join("backup.json"),
        serde_json::to_vec_pretty(
            &serde_json::json!({"product":"SocialFlow OS","kind":kind,"created_at":Utc::now().to_rfc3339(),"schema":10}),
        )?,
    )?;
    Ok(BackupRecord {
        name: folder
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        path: folder.to_string_lossy().into(),
        has_database: kind != "media",
        has_media: kind != "database",
        created_at: Utc::now().to_rfc3339(),
    })
}
pub fn list_backups(database: &Database) -> Result<Vec<BackupRecord>, AppError> {
    let folder = database.app_data_dir.join("backups");
    if !folder.exists() {
        return Ok(vec![]);
    }
    let mut rows = Vec::new();
    for entry in fs::read_dir(folder)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let path = entry.path();
        let created = entry
            .metadata()?
            .created()
            .ok()
            .map(chrono::DateTime::<Utc>::from)
            .unwrap_or_else(Utc::now)
            .to_rfc3339();
        rows.push(BackupRecord {
            name: entry.file_name().to_string_lossy().into(),
            path: path.to_string_lossy().into(),
            has_database: path.join("socialflow.sqlite").exists(),
            has_media: path.join("media").exists(),
            created_at: created,
        });
    }
    rows.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(rows)
}
pub fn request_restore(database: &Database, backup_path: &str) -> Result<String, AppError> {
    let folder = PathBuf::from(backup_path);
    let db_path = folder.join("socialflow.sqlite");
    if !db_path.is_file() {
        return Err(AppError::Validation(
            "Selected backup has no database".into(),
        ));
    }
    let check = Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?
        .query_row("PRAGMA integrity_check", [], |r| r.get::<_, String>(0))?;
    if check != "ok" {
        return Err(AppError::Validation(
            "Backup database failed integrity check".into(),
        ));
    }
    fs::write(
        database.app_data_dir.join("restore-pending.txt"),
        folder.to_string_lossy().as_bytes(),
    )?;
    Ok("Restore validated. Restart SocialFlow OS to apply it safely.".into())
}
pub fn apply_pending_restore(app_data: &Path) -> Result<(), AppError> {
    let marker = app_data.join("restore-pending.txt");
    if !marker.exists() {
        return Ok(());
    }
    let folder = PathBuf::from(fs::read_to_string(&marker)?.trim());
    let source = folder.join("socialflow.sqlite");
    if !source.is_file() {
        return Err(AppError::Validation(
            "Pending restore database is missing".into(),
        ));
    }
    let current = app_data.join("socialflow.sqlite");
    if current.exists() {
        fs::copy(&current, app_data.join("socialflow-before-restore.sqlite"))?;
    }
    fs::copy(source, current)?;
    if folder.join("media").exists() {
        let target = app_data.join("media");
        if target.exists() {
            fs::rename(
                &target,
                app_data.join(format!("media-before-restore-{}", Uuid::new_v4())),
            )?;
        }
        copy_tree(&folder.join("media"), &target)?;
    }
    fs::remove_file(marker)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{clients, database::Database};
    use rusqlite::Connection;
    use std::sync::Mutex;
    #[test]
    fn searches_audits_changes_settings_and_validates_backup() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        let folder = std::env::temp_dir().join(format!("socialflow-workspace-{}", Uuid::new_v4()));
        fs::create_dir_all(&folder).unwrap();
        let db = Database {
            connection: Mutex::new(connection),
            app_data_dir: folder.clone(),
        };
        clients::create_client(&db, clients::tests::input()).unwrap();
        assert_eq!(universal_search(&db, "ABC").unwrap().len(), 1);
        assert!(!list_activity(&db, None, None, 20).unwrap().is_empty());
        update_setting(&db, "scheduler.enabled", serde_json::Value::Bool(false)).unwrap();
        assert!(list_settings(&db)
            .unwrap()
            .iter()
            .any(|s| s.key == "scheduler.enabled" && s.value == serde_json::Value::Bool(false)));
        assert!(
            update_setting(&db, "privacy.ai_api_enabled", serde_json::Value::Bool(true)).is_err()
        );
        let backup = create_backup(&db, "database", None).unwrap();
        assert!(Path::new(&backup.path).join("socialflow.sqlite").exists());
        assert!(request_restore(&db, &backup.path)
            .unwrap()
            .contains("Restart"));
        let _ = fs::remove_dir_all(folder);
    }
}
