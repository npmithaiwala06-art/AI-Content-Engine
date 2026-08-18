use crate::{database::Database, error::AppError};
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignInput {
    pub client_id: String,
    pub name: String,
    pub description: String,
    pub objective: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub audience: String,
    pub platforms: Vec<String>,
    pub budget: Option<f64>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignRecord {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub name: String,
    pub description: String,
    pub objective: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub audience: String,
    pub platforms: Vec<String>,
    pub budget: Option<f64>,
    pub post_count: i64,
    pub created_at: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentPlanInput {
    pub client_id: String,
    pub campaign_id: Option<String>,
    pub name: String,
    pub plan_type: String,
    pub start_date: String,
    pub end_date: String,
    pub goal: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentPlanRecord {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub campaign_id: Option<String>,
    pub campaign_name: Option<String>,
    pub name: String,
    pub plan_type: String,
    pub start_date: String,
    pub end_date: String,
    pub goal: String,
    pub status: String,
    pub post_count: i64,
    pub created_at: String,
}
fn validate_campaign(input: &CampaignInput) -> Result<(), AppError> {
    if input.client_id.is_empty()
        || input.name.trim().is_empty()
        || input.objective.trim().is_empty()
    {
        return Err(AppError::Validation(
            "Client, campaign name and goal are required".into(),
        ));
    }
    if !["draft", "active", "paused", "completed", "archived"].contains(&input.status.as_str()) {
        return Err(AppError::Validation("Invalid campaign status".into()));
    }
    Ok(())
}
pub fn save_campaign(
    database: &Database,
    id: Option<String>,
    input: CampaignInput,
) -> Result<String, AppError> {
    validate_campaign(&input)?;
    let now = Utc::now().to_rfc3339();
    let id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let connection = database.connection.lock().expect("database lock poisoned");
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM campaigns WHERE id=?1)",
        [&id],
        |r| r.get(0),
    )?;
    if exists {
        connection.execute("UPDATE campaigns SET client_id=?2,name=?3,description=?4,objective=?5,start_date=?6,end_date=?7,status=?8,audience=?9,platforms=?10,budget=?11,updated_at=?12 WHERE id=?1",params![id,input.client_id,input.name.trim(),input.description.trim(),input.objective.trim(),input.start_date,input.end_date,input.status,input.audience.trim(),serde_json::to_string(&input.platforms)?,input.budget,now])?;
    } else {
        connection.execute("INSERT INTO campaigns(id,client_id,name,description,objective,start_date,end_date,status,audience,platforms,budget,created_at,updated_at)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)",params![id,input.client_id,input.name.trim(),input.description.trim(),input.objective.trim(),input.start_date,input.end_date,input.status,input.audience.trim(),serde_json::to_string(&input.platforms)?,input.budget,now])?;
    }
    Ok(id)
}
pub fn list_campaigns(
    database: &Database,
    client_id: Option<String>,
    status: Option<String>,
) -> Result<Vec<CampaignRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT ca.id,ca.client_id,c.name,ca.name,COALESCE(ca.description,''),COALESCE(ca.objective,''),COALESCE(ca.start_date,''),COALESCE(ca.end_date,''),ca.status,COALESCE(ca.audience,''),ca.platforms,ca.budget,(SELECT COUNT(*)FROM posts p WHERE p.campaign_id=ca.id AND p.deleted_at IS NULL),ca.created_at FROM campaigns ca JOIN clients c ON c.id=ca.client_id WHERE(?1 IS NULL OR ca.client_id=?1)AND(?2 IS NULL OR ?2='all' OR ca.status=?2)ORDER BY ca.updated_at DESC")?;
    let rows = stmt.query_map(params![client_id, status], |r| {
        let platforms: String = r.get(10)?;
        Ok(CampaignRecord {
            id: r.get(0)?,
            client_id: r.get(1)?,
            client_name: r.get(2)?,
            name: r.get(3)?,
            description: r.get(4)?,
            objective: r.get(5)?,
            start_date: r.get(6)?,
            end_date: r.get(7)?,
            status: r.get(8)?,
            audience: r.get(9)?,
            platforms: serde_json::from_str(&platforms).unwrap_or_default(),
            budget: r.get(11)?,
            post_count: r.get(12)?,
            created_at: r.get(13)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
pub fn archive_campaign(database: &Database, id: &str) -> Result<(), AppError> {
    let changed = database
        .connection
        .lock()
        .expect("database lock poisoned")
        .execute(
            "UPDATE campaigns SET status='archived',updated_at=?2 WHERE id=?1",
            params![id, Utc::now().to_rfc3339()],
        )?;
    if changed == 0 {
        return Err(AppError::NotFound("Campaign not found".into()));
    }
    Ok(())
}
pub fn save_content_plan(database: &Database, input: ContentPlanInput) -> Result<String, AppError> {
    if input.client_id.is_empty()
        || input.name.trim().is_empty()
        || !["single", "7_day", "15_day", "30_day", "campaign"].contains(&input.plan_type.as_str())
    {
        return Err(AppError::Validation(
            "Client, plan name and valid plan type are required".into(),
        ));
    }
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    database.connection.lock().expect("database lock poisoned").execute("INSERT INTO content_plans(id,client_id,campaign_id,name,plan_type,start_date,end_date,goal,status,created_at,updated_at)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,'draft',?9,?9)",params![id,input.client_id,input.campaign_id,input.name.trim(),input.plan_type,input.start_date,input.end_date,input.goal.trim(),now])?;
    Ok(id)
}
pub fn list_content_plans(
    database: &Database,
    client_id: Option<String>,
) -> Result<Vec<ContentPlanRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT cp.id,cp.client_id,c.name,cp.campaign_id,ca.name,cp.name,cp.plan_type,COALESCE(cp.start_date,''),COALESCE(cp.end_date,''),COALESCE(cp.goal,''),cp.status,(SELECT COUNT(*)FROM posts p WHERE p.content_plan_id=cp.id AND p.deleted_at IS NULL),cp.created_at FROM content_plans cp JOIN clients c ON c.id=cp.client_id LEFT JOIN campaigns ca ON ca.id=cp.campaign_id WHERE(?1 IS NULL OR cp.client_id=?1)ORDER BY cp.created_at DESC")?;
    let rows = stmt.query_map([client_id], |r| {
        Ok(ContentPlanRecord {
            id: r.get(0)?,
            client_id: r.get(1)?,
            client_name: r.get(2)?,
            campaign_id: r.get(3)?,
            campaign_name: r.get(4)?,
            name: r.get(5)?,
            plan_type: r.get(6)?,
            start_date: r.get(7)?,
            end_date: r.get(8)?,
            goal: r.get(9)?,
            status: r.get(10)?,
            post_count: r.get(11)?,
            created_at: r.get(12)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
pub fn get_campaign(database: &Database, id: &str) -> Result<CampaignRecord, AppError> {
    list_campaigns(database, None, None)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::NotFound("Campaign not found".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{clients, database::Database};
    use rusqlite::Connection;
    use std::sync::Mutex;
    #[test]
    fn manages_campaigns_and_bulk_plans() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        let db = Database {
            connection: Mutex::new(connection),
            app_data_dir: std::env::temp_dir(),
        };
        let client = clients::create_client(&db, clients::tests::input()).unwrap();
        let campaign = save_campaign(
            &db,
            None,
            CampaignInput {
                client_id: client.clone(),
                name: "Diwali Sale".into(),
                description: "Seasonal".into(),
                objective: "Increase sales".into(),
                start_date: "2026-10-01".into(),
                end_date: "2026-10-25".into(),
                status: "active".into(),
                audience: "Local shoppers".into(),
                platforms: vec!["instagram".into(), "facebook".into()],
                budget: Some(1000.0),
            },
        )
        .unwrap();
        assert_eq!(get_campaign(&db, &campaign).unwrap().platforms.len(), 2);
        save_content_plan(
            &db,
            ContentPlanInput {
                client_id: client,
                campaign_id: Some(campaign.clone()),
                name: "15-day sale plan".into(),
                plan_type: "15_day".into(),
                start_date: "2026-10-01".into(),
                end_date: "2026-10-15".into(),
                goal: "Sales".into(),
            },
        )
        .unwrap();
        assert_eq!(list_content_plans(&db, None).unwrap().len(), 1);
        archive_campaign(&db, &campaign).unwrap();
        assert_eq!(get_campaign(&db, &campaign).unwrap().status, "archived");
    }
}
