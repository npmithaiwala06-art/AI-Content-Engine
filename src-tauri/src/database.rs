use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;

use crate::error::AppError;

const INITIAL_SCHEMA: &str = include_str!("../migrations/001_initial_schema.sql");
const CLIENTS_MIGRATION: &str = include_str!("../migrations/002_clients_and_brand_profiles.sql");
const AI_WORKSPACE_MIGRATION: &str = include_str!("../migrations/003_ai_workspace.sql");
const CONTENT_IMPORTER_MIGRATION: &str = include_str!("../migrations/004_content_importer.sql");
const MEDIA_LIBRARY_MIGRATION: &str = include_str!("../migrations/005_media_library.sql");
const CALENDAR_MIGRATION: &str = include_str!("../migrations/006_calendar_and_idempotency.sql");
const AUTOMATION_MIGRATION: &str = include_str!("../migrations/007_automation_engine.sql");
const ANALYTICS_MIGRATION: &str = include_str!("../migrations/008_analytics_learning.sql");
const REPORTS_MIGRATION: &str = include_str!("../migrations/009_reports_export.sql");
const CAMPAIGNS_MIGRATION: &str = include_str!("../migrations/010_campaigns_plans.sql");
const TWITTER_MIGRATION: &str = include_str!("../migrations/011_replace_linkedin_with_twitter.sql");
const RESTORE_TWITTER_MIGRATION: &str =
    include_str!("../migrations/013_restore_twitter_platform.sql");

pub struct Database {
    pub(crate) connection: Mutex<Connection>,
    pub(crate) app_data_dir: PathBuf,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub clients: i64,
    pub connected_accounts: i64,
    pub draft_posts: i64,
    pub waiting_approval: i64,
    pub approved: i64,
    pub scheduled: i64,
    pub published: i64,
    pub failed: i64,
    pub scheduled_today: i64,
    pub published_today: i64,
    pub monthly_reach: i64,
    pub monthly_engagement: i64,
    pub today_schedule: Vec<DashboardSchedule>,
    pub recent_activity: Vec<DashboardActivity>,
    pub performance: Vec<DashboardPerformance>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSchedule {
    pub id: String,
    pub client: String,
    pub platform: String,
    pub title: String,
    pub scheduled_for: String,
    pub status: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardActivity {
    pub id: String,
    pub action: String,
    pub summary: String,
    pub client_name: Option<String>,
    pub created_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardPerformance {
    pub day: String,
    pub instagram: i64,
    pub facebook: i64,
    pub twitter: i64,
    pub youtube: i64,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "busy_timeout", 5000)?;
        apply_migrations(&connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
            app_data_dir: path
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .to_path_buf(),
        })
    }

    pub fn dashboard_summary(&self) -> Result<DashboardSummary, AppError> {
        let connection = self.connection.lock().expect("database lock poisoned");
        let query_count = |sql: &str| connection.query_row(sql, [], |row| row.get::<_, i64>(0));

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let month = chrono::Local::now().format("%Y-%m-01").to_string();
        let scheduled_today = connection.query_row("SELECT COUNT(*) FROM schedules WHERE scheduled_for>=?1 AND scheduled_for<?2 AND status NOT IN('cancelled')",rusqlite::params![format!("{today}T00:00:00"),format!("{today}T23:59:59")],|r|r.get(0))?;
        let published_today = connection.query_row(
            "SELECT COUNT(*) FROM publishing_queue WHERE status='published' AND updated_at LIKE ?1",
            [format!("{today}%")],
            |r| r.get(0),
        )?;
        let (monthly_reach,monthly_engagement)=connection.query_row("SELECT COALESCE(SUM(reach),0),COALESCE(SUM(COALESCE(likes,0)+COALESCE(comments,0)+COALESCE(shares,0)+COALESCE(saves,0)),0)FROM analytics WHERE period_start>=?1",[month],|r|Ok((r.get(0)?,r.get(1)?)))?;
        let mut stmt=connection.prepare("SELECT s.id,c.name,pv.platform_id,COALESCE(p.title,''),s.scheduled_for,p.status FROM schedules s JOIN post_versions pv ON pv.id=s.post_version_id JOIN posts p ON p.id=pv.post_id JOIN clients c ON c.id=p.client_id WHERE s.scheduled_for>=?1 AND s.scheduled_for<?2 AND s.status NOT IN('cancelled')ORDER BY s.scheduled_for LIMIT 12")?;
        let today_schedule = stmt
            .query_map(
                rusqlite::params![format!("{today}T00:00:00"), format!("{today}T23:59:59")],
                |r| {
                    Ok(DashboardSchedule {
                        id: r.get(0)?,
                        client: r.get(1)?,
                        platform: r.get(2)?,
                        title: r.get(3)?,
                        scheduled_for: r.get(4)?,
                        status: r.get(5)?,
                    })
                },
            )?
            .collect::<Result<Vec<_>, _>>()?;
        let mut stmt=connection.prepare("SELECT a.id,a.action,a.summary,c.name,a.created_at FROM activity_logs a LEFT JOIN clients c ON c.id=a.client_id ORDER BY a.created_at DESC LIMIT 8")?;
        let recent_activity = stmt
            .query_map([], |r| {
                Ok(DashboardActivity {
                    id: r.get(0)?,
                    action: r.get(1)?,
                    summary: r.get(2)?,
                    client_name: r.get(3)?,
                    created_at: r.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        let seven_days = (chrono::Local::now() - chrono::Duration::days(6))
            .format("%Y-%m-%d")
            .to_string();
        let mut stmt=connection.prepare("SELECT period_start,sa.platform_id,COALESCE(SUM(reach),0)FROM analytics a JOIN social_accounts sa ON sa.id=a.social_account_id WHERE period_start>=?1 GROUP BY period_start,sa.platform_id ORDER BY period_start")?;
        let rows = stmt.query_map([seven_days], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
            ))
        })?;
        let mut map = std::collections::BTreeMap::<String, DashboardPerformance>::new();
        for row in rows {
            let (day, platform, reach) = row?;
            let entry = map.entry(day.clone()).or_insert(DashboardPerformance {
                day,
                instagram: 0,
                facebook: 0,
                twitter: 0,
                youtube: 0,
            });
            match platform.as_str() {
                "instagram" => entry.instagram = reach,
                "facebook" => entry.facebook = reach,
                "twitter" => entry.twitter = reach,
                "youtube" => entry.youtube = reach,
                _ => {}
            }
        }
        let performance = map.into_values().collect();
        Ok(DashboardSummary {
            clients: query_count("SELECT COUNT(*) FROM clients WHERE archived_at IS NULL")?,
            connected_accounts: query_count(
                "SELECT COUNT(*) FROM social_accounts WHERE connection_status = 'connected'",
            )?,
            draft_posts: query_count("SELECT COUNT(*) FROM posts WHERE status = 'draft'")?,
            waiting_approval: query_count(
                "SELECT COUNT(*) FROM posts WHERE status = 'needs_review'",
            )?,
            approved: query_count("SELECT COUNT(*) FROM posts WHERE status = 'approved'")?,
            scheduled: query_count("SELECT COUNT(*) FROM posts WHERE status = 'scheduled'")?,
            published: query_count("SELECT COUNT(*) FROM posts WHERE status = 'published'")?,
            failed: query_count("SELECT COUNT(*) FROM posts WHERE status = 'failed'")?,
            scheduled_today,
            published_today,
            monthly_reach,
            monthly_engagement,
            today_schedule,
            recent_activity,
            performance,
        })
    }
}

pub(crate) fn apply_migrations(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.execute_batch(INITIAL_SCHEMA)?;
    let current_version: Option<i64> = connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .optional()?
        .flatten();

    for (version, migration) in [
        (2, CLIENTS_MIGRATION),
        (3, AI_WORKSPACE_MIGRATION),
        (4, CONTENT_IMPORTER_MIGRATION),
        (5, MEDIA_LIBRARY_MIGRATION),
        (6, CALENDAR_MIGRATION),
        (7, AUTOMATION_MIGRATION),
        (8, ANALYTICS_MIGRATION),
        (9, REPORTS_MIGRATION),
        (10, CAMPAIGNS_MIGRATION),
        (11, TWITTER_MIGRATION),
        (13, RESTORE_TWITTER_MIGRATION),
    ] {
        if current_version.unwrap_or(0) >= version {
            continue;
        }
        connection.execute_batch("BEGIN IMMEDIATE")?;
        if let Err(error) = connection.execute_batch(migration) {
            let _ = connection.execute_batch("ROLLBACK");
            return Err(error);
        }
        connection.execute_batch("COMMIT")?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_the_complete_schema_in_memory() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        apply_migrations(&connection).unwrap();

        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('clients', 'posts', 'schedules', 'analytics')",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(count, 4);

        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(version, 13);

        let ai_prompts_table: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='ai_prompts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(ai_prompts_table, 1);

        let imports_table: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='content_imports'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(imports_table, 1);

        let twitter_platform: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM platforms WHERE id='twitter' AND adapter_key='twitter' AND is_enabled=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(twitter_platform, 1);

        let removed_platforms: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM platforms WHERE id IN ('linkedin', 'x')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(removed_platforms, 0);
    }

    #[test]
    fn restores_x_records_to_the_supported_twitter_platform() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        apply_migrations(&connection).unwrap();

        connection
            .execute(
                "INSERT INTO platforms(id,display_name,adapter_key,is_enabled,is_initial) VALUES('x','X','x',1,1)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO clients(id,name,company_name,brand_name,status,main_platforms,created_at,updated_at) VALUES('client-x','Client X','Client X','Client X','active','[\"instagram\",\"x\"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO posts(id,client_id,title,core_idea,content_type,status,created_at,updated_at) VALUES('post-x','client-x','Post X','Test','image_post','draft',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO post_versions(id,post_id,platform_id) VALUES('version-x','post-x','x')",
                [],
            )
            .unwrap();
        connection
            .execute("DELETE FROM schema_migrations WHERE version=13", [])
            .unwrap();

        apply_migrations(&connection).unwrap();

        let platform: String = connection
            .query_row(
                "SELECT platform_id FROM post_versions WHERE id='version-x'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let client_platforms: String = connection
            .query_row(
                "SELECT main_platforms FROM clients WHERE id='client-x'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let x_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM platforms WHERE id='x'", [], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(platform, "twitter");
        assert_eq!(client_platforms, "[\"instagram\",\"twitter\"]");
        assert_eq!(x_count, 0);
    }

    #[test]
    fn restores_x_records_without_aborting_on_an_existing_twitter_account() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        apply_migrations(&connection).unwrap();
        connection.execute_batch(
            "INSERT INTO platforms(id,display_name,adapter_key,is_enabled,is_initial) VALUES('x','X','x',1,1);
             INSERT INTO clients(id,name,company_name,brand_name,status,created_at,updated_at) VALUES('collision-client','Collision Client','Collision Client','Collision Client','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
             INSERT INTO social_accounts(id,client_id,platform_id,account_name,external_account_id,connection_status) VALUES('twitter-account','collision-client','twitter','Twitter account','same-user','disconnected');
             INSERT INTO social_accounts(id,client_id,platform_id,account_name,external_account_id,connection_status) VALUES('x-account','collision-client','x','X account','same-user','connected');
             DELETE FROM schema_migrations WHERE version=13;",
        ).unwrap();

        apply_migrations(&connection).unwrap();

        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM social_accounts WHERE client_id='collision-client' AND platform_id='twitter' AND external_account_id='same-user'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn handles_many_clients_and_posts_with_cascades() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        apply_migrations(&connection).unwrap();

        for client_number in 0..5 {
            let client_id = format!("client-{client_number}");
            connection.execute(
                "INSERT INTO clients(id,name,company_name,brand_name,status,created_at,updated_at) VALUES(?1,?2,?2,?2,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                rusqlite::params![client_id, format!("Client {client_number}")],
            ).unwrap();
            for post_number in 0..500 {
                let status = if post_number % 2 == 0 {
                    "draft"
                } else {
                    "published"
                };
                connection.execute(
                    "INSERT INTO posts(id,client_id,title,core_idea,content_type,status,created_at,updated_at) VALUES(?1,?2,?3,'Scale test','image_post',?4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                    rusqlite::params![format!("post-{client_number}-{post_number}"), client_id, format!("Post {post_number}"), status],
                ).unwrap();
            }
        }

        let drafts: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM posts WHERE client_id='client-3' AND status='draft'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(drafts, 250);

        connection
            .execute("DELETE FROM clients WHERE id='client-0'", [])
            .unwrap();
        let posts: i64 = connection
            .query_row("SELECT COUNT(*) FROM posts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(posts, 2_000);
    }
}
