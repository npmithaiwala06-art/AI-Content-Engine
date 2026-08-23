use crate::{database::Database, error::AppError};
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricPoint {
    pub label: String,
    pub reach: i64,
    pub engagement: i64,
    pub followers_gained: i64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformMetric {
    pub platform: String,
    pub posts: i64,
    pub reach: i64,
    pub engagement: i64,
    pub engagement_rate: f64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopPost {
    pub post_id: String,
    pub title: String,
    pub platform: String,
    pub reach: i64,
    pub engagement: i64,
    pub engagement_rate: f64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsDashboard {
    pub total_reach: i64,
    pub total_engagement: i64,
    pub followers_gained: i64,
    pub best_platform: String,
    pub best_post: String,
    pub time_series: Vec<MetricPoint>,
    pub platform_comparison: Vec<PlatformMetric>,
    pub top_posts: Vec<TopPost>,
    pub content_type_performance: Vec<PlatformMetric>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationInput {
    pub client_id: String,
    pub period_start: String,
    pub period_end: String,
    pub findings: Vec<String>,
    pub successful_topics: Vec<String>,
    pub weak_topics: Vec<String>,
    pub successful_formats: Vec<String>,
    pub weak_formats: Vec<String>,
    pub posting_recommendations: Vec<String>,
    pub strategy_recommendations: Vec<String>,
    pub future_ideas: Vec<String>,
    pub raw_content: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationRecord {
    pub id: String,
    pub client_id: String,
    pub period_start: String,
    pub period_end: String,
    pub findings: Vec<String>,
    pub successful_topics: Vec<String>,
    pub successful_formats: Vec<String>,
    pub weak_formats: Vec<String>,
    pub strategy_recommendations: Vec<String>,
    pub future_ideas: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialAnalyticsCollection {
    pub collected: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

fn number(value: Option<&serde_json::Value>) -> i64 {
    value
        .and_then(|value| {
            value
                .as_i64()
                .or_else(|| value.as_str().and_then(|text| text.parse().ok()))
        })
        .unwrap_or(0)
}

fn graph_metric(raw: &serde_json::Value, name: &str) -> i64 {
    raw.get("data")
        .and_then(|value| value.as_array())
        .and_then(|metrics| {
            metrics
                .iter()
                .find(|metric| metric.get("name").and_then(|value| value.as_str()) == Some(name))
        })
        .and_then(|metric| {
            metric
                .get("values")
                .and_then(|value| value.as_array())
                .and_then(|values| values.first())
                .and_then(|value| value.get("value"))
        })
        .map(|value| number(Some(value)))
        .unwrap_or(0)
}

fn normalise_official_metrics(
    platform: &str,
    raw: &serde_json::Value,
) -> (i64, i64, i64, i64, i64, i64, i64, i64) {
    match platform {
        "facebook" => (
            graph_metric(raw, "post_impressions_unique"),
            graph_metric(raw, "post_impressions"),
            0,
            graph_metric(raw, "post_engaged_users"),
            0,
            0,
            0,
            graph_metric(raw, "post_clicks"),
        ),
        "instagram" => (
            graph_metric(raw, "reach"),
            graph_metric(raw, "impressions"),
            graph_metric(raw, "views"),
            graph_metric(raw, "likes"),
            graph_metric(raw, "comments"),
            graph_metric(raw, "shares"),
            graph_metric(raw, "saved"),
            0,
        ),
        "twitter" => (
            number(
                raw.pointer("/data/public_metrics/impression_count")
                    .or_else(|| raw.pointer("/data/non_public_metrics/impression_count")),
            ),
            number(
                raw.pointer("/data/public_metrics/impression_count")
                    .or_else(|| raw.pointer("/data/non_public_metrics/impression_count")),
            ),
            0,
            number(raw.pointer("/data/public_metrics/like_count")),
            number(raw.pointer("/data/public_metrics/reply_count")),
            number(raw.pointer("/data/public_metrics/retweet_count"))
                + number(raw.pointer("/data/public_metrics/quote_count")),
            0,
            number(raw.pointer("/data/non_public_metrics/url_link_clicks")),
        ),
        "youtube" => (
            number(raw.pointer("/items/0/statistics/viewCount")),
            number(raw.pointer("/items/0/statistics/viewCount")),
            number(raw.pointer("/items/0/statistics/viewCount")),
            number(raw.pointer("/items/0/statistics/likeCount")),
            number(raw.pointer("/items/0/statistics/commentCount")),
            0,
            0,
            0,
        ),
        _ => (0, 0, 0, 0, 0, 0, 0, 0),
    }
}

pub fn collect_official_analytics(
    database: &Database,
) -> Result<OfficialAnalyticsCollection, AppError> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let rows = {
        let connection = database.connection.lock().expect("database lock poisoned");
        let mut statement = connection.prepare("SELECT q.external_post_id,p.client_id,s.social_account_id,pv.id,p.campaign_id,p.content_type,pv.platform_id,sa.external_account_id,sa.auth_storage_key,sa.settings FROM publishing_queue q JOIN schedules s ON s.id=q.schedule_id JOIN post_versions pv ON pv.id=s.post_version_id JOIN posts p ON p.id=pv.post_id JOIN social_accounts sa ON sa.id=s.social_account_id WHERE q.status='published' AND q.external_post_id IS NOT NULL AND sa.connection_status='connected' AND NOT EXISTS(SELECT 1 FROM analytics a WHERE a.external_post_id=q.external_post_id AND a.period_end=?1)")?;
        let values = statement
            .query_map([&today], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        values
    };
    let now = Utc::now().to_rfc3339();
    let mut result = OfficialAnalyticsCollection {
        collected: 0,
        failed: 0,
        errors: vec![],
    };
    for (
        external,
        client,
        account,
        version,
        campaign,
        content_type,
        platform,
        platform_account_id,
        storage_key,
        settings,
    ) in rows
    {
        let token = match crate::security::read_oauth_token(&storage_key) {
            Ok(token) => token,
            Err(error) => {
                result.failed += 1;
                result.errors.push(format!("{platform}: {error}"));
                continue;
            }
        };
        let adapter = match crate::platforms::official_adapter(
            &platform,
            token,
            platform_account_id,
            serde_json::from_str(&settings).unwrap_or_else(|_| json!({})),
        ) {
            Ok(adapter) => adapter,
            Err(error) => {
                result.failed += 1;
                result.errors.push(format!("{platform}: {error}"));
                continue;
            }
        };
        let raw = match adapter.fetch_analytics(&external) {
            Ok(raw) => raw,
            Err(error) => {
                result.failed += 1;
                result.errors.push(format!("{platform}: {error}"));
                continue;
            }
        };
        let (reach, impressions, views, likes, comments, shares, saves, clicks) =
            normalise_official_metrics(&platform, &raw);
        let engagement = likes + comments + shares + saves;
        let rate = if reach > 0 {
            engagement as f64 / reach as f64 * 100.0
        } else {
            0.0
        };
        database.connection.lock().expect("database lock poisoned").execute("INSERT INTO analytics(id,client_id,social_account_id,post_version_id,external_post_id,period_start,period_end,collected_at,reach,impressions,views,likes,comments,shares,saves,clicks,engagement_rate,raw_metrics,campaign_id,content_type) VALUES(?1,?2,?3,?4,?5,?6,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)",params![Uuid::new_v4().to_string(),client,account,version,external,today,now,reach,impressions,views,likes,comments,shares,saves,clicks,rate,raw.to_string(),campaign,content_type])?;
        result.collected += 1;
    }
    Ok(result)
}

pub fn collect_mock_analytics(database: &Database) -> Result<usize, AppError> {
    let rows = {
        let connection = database.connection.lock().expect("database lock poisoned");
        let mut stmt=connection.prepare("SELECT q.external_post_id,p.client_id,s.social_account_id,pv.id,p.campaign_id,p.content_type,date(q.updated_at),pv.platform_id FROM publishing_queue q JOIN schedules s ON s.id=q.schedule_id JOIN post_versions pv ON pv.id=s.post_version_id JOIN posts p ON p.id=pv.post_id WHERE q.status='published' AND q.external_post_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM analytics a WHERE a.external_post_id=q.external_post_id)")?;
        let values = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, Option<String>>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, String>(7)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        values
    };
    let now = Utc::now().to_rfc3339();
    let connection = database.connection.lock().expect("database lock poisoned");
    for (external, client, account, version, campaign, content_type, date, platform) in &rows {
        let seed = external
            .bytes()
            .fold(0_u64, |a, b| a.wrapping_mul(31).wrapping_add(u64::from(b)));
        let reach = 500 + (seed % 9500) as i64;
        let impressions = reach + (seed % 2500) as i64;
        let likes = (reach as f64 * (0.025 + (seed % 70) as f64 / 1000.0)) as i64;
        let comments = (likes / 8).max(1);
        let shares = (likes / 12).max(1);
        let saves = (likes / 6).max(1);
        let clicks = (likes / 5).max(1);
        let engagement = likes + comments + shares + saves;
        let rate = engagement as f64 / reach as f64 * 100.0;
        connection.execute("INSERT INTO analytics(id,client_id,social_account_id,post_version_id,external_post_id,period_start,period_end,collected_at,reach,impressions,views,likes,comments,shares,saves,clicks,followers_gained,followers,engagement_rate,raw_metrics,campaign_id,content_type)VALUES(?1,?2,?3,?4,?5,?6,?6,?7,?8,?9,?9,?10,?11,?12,?13,?14,?15,NULL,?16,?17,?18,?19)",params![Uuid::new_v4().to_string(),client,account,version,external,date,now,reach,impressions,likes,comments,shares,saves,clicks,(seed%35)as i64,rate,json!({"mode":"mock","platform":platform}).to_string(),campaign,content_type])?;
    }
    Ok(rows.len())
}

pub fn dashboard(
    database: &Database,
    client_id: Option<String>,
    platform: Option<String>,
    campaign_id: Option<String>,
    start: &str,
    end: &str,
) -> Result<AnalyticsDashboard, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let filter=" FROM analytics a JOIN social_accounts sa ON sa.id=a.social_account_id LEFT JOIN post_versions pv ON pv.id=a.post_version_id LEFT JOIN posts p ON p.id=pv.post_id WHERE a.period_start>=?1 AND a.period_end<=?2 AND (?3 IS NULL OR a.client_id=?3) AND (?4 IS NULL OR ?4='all' OR sa.platform_id=?4) AND (?5 IS NULL OR a.campaign_id=?5)";
    let totals=connection.query_row(&format!("SELECT COALESCE(SUM(a.reach),0),COALESCE(SUM(COALESCE(a.likes,0)+COALESCE(a.comments,0)+COALESCE(a.shares,0)+COALESCE(a.saves,0)),0),COALESCE(SUM(a.followers_gained),0){filter}"),params![start,end,client_id,platform,campaign_id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,i64>(2)?)))?;
    let query_points = |select: &str,
                        group: &str|
     -> Result<Vec<(String, i64, i64, i64)>, AppError> {
        let mut stmt=connection.prepare(&format!("SELECT {select},COALESCE(SUM(a.reach),0),COALESCE(SUM(COALESCE(a.likes,0)+COALESCE(a.comments,0)+COALESCE(a.shares,0)+COALESCE(a.saves,0)),0),COALESCE(SUM(a.followers_gained),0){filter} GROUP BY {group} ORDER BY {group}"))?;
        let rows = stmt.query_map(params![start, end, client_id, platform, campaign_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    };
    let time_series = query_points("a.period_start", "a.period_start")?
        .into_iter()
        .map(|v| MetricPoint {
            label: v.0,
            reach: v.1,
            engagement: v.2,
            followers_gained: v.3,
        })
        .collect();
    let mut stmt=connection.prepare(&format!("SELECT sa.platform_id,COUNT(*),COALESCE(SUM(a.reach),0),COALESCE(SUM(COALESCE(a.likes,0)+COALESCE(a.comments,0)+COALESCE(a.shares,0)+COALESCE(a.saves,0)),0){filter} GROUP BY sa.platform_id ORDER BY 4 DESC"))?;
    let platform_comparison = stmt
        .query_map(params![start, end, client_id, platform, campaign_id], |r| {
            let reach: i64 = r.get(2)?;
            let engagement: i64 = r.get(3)?;
            Ok(PlatformMetric {
                platform: r.get(0)?,
                posts: r.get(1)?,
                reach,
                engagement,
                engagement_rate: if reach > 0 {
                    engagement as f64 / reach as f64 * 100.0
                } else {
                    0.0
                },
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    // Account-level analytics (for example follower or page totals) may not be
    // linked to a specific post version. They still belong in totals and
    // platform charts, but must not be decoded as a TopPost with a required id.
    let mut stmt=connection.prepare(&format!("SELECT p.id,COALESCE(p.title,''),sa.platform_id,COALESCE(a.reach,0),COALESCE(a.likes,0)+COALESCE(a.comments,0)+COALESCE(a.shares,0)+COALESCE(a.saves,0),COALESCE(a.engagement_rate,0){filter} AND p.id IS NOT NULL ORDER BY 6 DESC LIMIT 10"))?;
    let top_posts = stmt
        .query_map(params![start, end, client_id, platform, campaign_id], |r| {
            Ok(TopPost {
                post_id: r.get(0)?,
                title: r.get(1)?,
                platform: r.get(2)?,
                reach: r.get(3)?,
                engagement: r.get(4)?,
                engagement_rate: r.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut stmt=connection.prepare(&format!("SELECT COALESCE(a.content_type,'unknown'),COUNT(*),COALESCE(SUM(a.reach),0),COALESCE(SUM(COALESCE(a.likes,0)+COALESCE(a.comments,0)+COALESCE(a.shares,0)+COALESCE(a.saves,0)),0){filter} GROUP BY a.content_type ORDER BY 4 DESC"))?;
    let content_type_performance = stmt
        .query_map(params![start, end, client_id, platform, campaign_id], |r| {
            let reach: i64 = r.get(2)?;
            let engagement: i64 = r.get(3)?;
            Ok(PlatformMetric {
                platform: r.get(0)?,
                posts: r.get(1)?,
                reach,
                engagement,
                engagement_rate: if reach > 0 {
                    engagement as f64 / reach as f64 * 100.0
                } else {
                    0.0
                },
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let best_platform = platform_comparison
        .first()
        .map(|v| v.platform.clone())
        .unwrap_or_else(|| "—".into());
    let best_post = top_posts
        .first()
        .map(|v| v.title.clone())
        .unwrap_or_else(|| "—".into());
    Ok(AnalyticsDashboard {
        total_reach: totals.0,
        total_engagement: totals.1,
        followers_gained: totals.2,
        best_platform,
        best_post,
        time_series,
        platform_comparison,
        top_posts,
        content_type_performance,
    })
}

pub fn analytics_prompt(
    database: &Database,
    client_id: &str,
    start: &str,
    end: &str,
) -> Result<String, AppError> {
    let client = crate::clients::get_client(database, client_id)?;
    let data = dashboard(database, Some(client_id.into()), None, None, start, end)?;
    let prior = list_recommendations(database, Some(client_id.into()))?
        .into_iter()
        .take(1)
        .collect::<Vec<_>>();
    Ok(format!("You are a senior social-media strategist. Analyse this local performance export.\n\nCLIENT: {}\nBRAND VOICE: {}\nAUDIENCE: {}\nPERIOD: {} to {}\n\nMETRICS JSON:\n{}\n\nPREVIOUS RECOMMENDATIONS JSON:\n{}\n\nGive: 1) overall performance, 2) what worked, 3) what failed, 4) best platforms, 5) best formats, 6) best topics, 7) posting patterns, 8) recommendations, 9) next strategy, 10) future ideas. End with a valid JSON object using keys findings, successful_topics, weak_topics, successful_formats, weak_formats, posting_recommendations, strategy_recommendations, future_ideas. No markdown inside the JSON.",client.client_name,client.brand_profile.brand_voice,client.target_audience,start,end,serde_json::to_string_pretty(&data)?,serde_json::to_string_pretty(&prior)?))
}
pub fn import_recommendations(
    database: &Database,
    input: RecommendationInput,
) -> Result<String, AppError> {
    if input.strategy_recommendations.is_empty() {
        return Err(AppError::Validation(
            "Add at least one strategy recommendation".into(),
        ));
    }
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let connection = database.connection.lock().expect("database lock poisoned");
    connection.execute("INSERT INTO ai_recommendations(id,client_id,period_start,period_end,findings,successful_topics,weak_topics,successful_formats,weak_formats,posting_recommendations,strategy_recommendations,future_ideas,raw_content,created_at)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",params![id,input.client_id,input.period_start,input.period_end,serde_json::to_string(&input.findings)?,serde_json::to_string(&input.successful_topics)?,serde_json::to_string(&input.weak_topics)?,serde_json::to_string(&input.successful_formats)?,serde_json::to_string(&input.weak_formats)?,serde_json::to_string(&input.posting_recommendations)?,serde_json::to_string(&input.strategy_recommendations)?,serde_json::to_string(&input.future_ideas)?,input.raw_content,now])?;
    Ok(id)
}
pub fn list_recommendations(
    database: &Database,
    client_id: Option<String>,
) -> Result<Vec<RecommendationRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT id,client_id,COALESCE(period_start,''),COALESCE(period_end,''),findings,successful_topics,successful_formats,weak_formats,strategy_recommendations,future_ideas,created_at FROM ai_recommendations WHERE (?1 IS NULL OR client_id=?1) ORDER BY created_at DESC LIMIT 50")?;
    let rows = stmt.query_map([client_id], |r| {
        let parse = |i| {
            let v: String = r.get(i)?;
            Ok::<Vec<String>, rusqlite::Error>(serde_json::from_str(&v).unwrap_or_default())
        };
        Ok(RecommendationRecord {
            id: r.get(0)?,
            client_id: r.get(1)?,
            period_start: r.get(2)?,
            period_end: r.get(3)?,
            findings: parse(4)?,
            successful_topics: parse(5)?,
            successful_formats: parse(6)?,
            weak_formats: parse(7)?,
            strategy_recommendations: parse(8)?,
            future_ideas: parse(9)?,
            created_at: r.get(10)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{approvals, automation, calendar, clients, content_studio, database::Database};
    use chrono::Local;
    use rusqlite::Connection;
    use std::sync::Mutex;

    #[test]
    fn normalises_youtube_statistics_without_losing_string_counts() {
        let raw = json!({"items":[{"statistics":{"viewCount":"1200","likeCount":"84","commentCount":"7"}}]});
        let metrics = normalise_official_metrics("youtube", &raw);
        assert_eq!(metrics.0, 1200);
        assert_eq!(metrics.3, 84);
        assert_eq!(metrics.4, 7);
    }

    #[test]
    fn normalises_twitter_post_metrics() {
        let raw = json!({
            "data": {
                "public_metrics": {
                    "impression_count": 2300,
                    "like_count": 96,
                    "reply_count": 12,
                    "retweet_count": 18,
                    "quote_count": 4
                },
                "non_public_metrics": { "url_link_clicks": 37 }
            }
        });
        let metrics = normalise_official_metrics("twitter", &raw);
        assert_eq!(metrics, (2300, 2300, 0, 96, 12, 22, 0, 37));
    }
    #[test]
    fn collects_metrics_and_closes_the_learning_loop() {
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
        let post =
            content_studio::save_post(&db, None, content_studio::tests::input(client.clone()))
                .unwrap();
        content_studio::submit_post_for_review(&db, &post).unwrap();
        approvals::approve_post(&db, &post, "").unwrap();
        let past = (Local::now() - chrono::Duration::minutes(1))
            .format("%Y-%m-%dT%H:%M:%S")
            .to_string();
        let account = crate::social_accounts::connect_mock_account(
            &db,
            &client,
            "instagram",
            "Selected analytics account",
        )
        .unwrap();
        calendar::schedule_post(
            &db,
            &post,
            &past,
            "Asia/Kolkata",
            std::collections::HashMap::from([("instagram".into(), account)]),
        )
        .unwrap();
        automation::tick(&db).unwrap();
        assert_eq!(collect_mock_analytics(&db).unwrap(), 1);
        let metrics = dashboard(
            &db,
            Some(client.clone()),
            None,
            None,
            "2020-01-01",
            "2030-01-01",
        )
        .unwrap();
        assert!(metrics.total_reach > 0);
        let account_id: String = db
            .connection
            .lock()
            .expect("database lock poisoned")
            .query_row(
                "SELECT id FROM social_accounts WHERE client_id=?1 LIMIT 1",
                [&client],
                |row| row.get(0),
            )
            .unwrap();
        db.connection
            .lock()
            .expect("database lock poisoned")
            .execute(
                "INSERT INTO analytics(id,client_id,social_account_id,post_version_id,external_post_id,period_start,period_end,collected_at,reach,likes,comments,shares,saves,followers_gained,engagement_rate,raw_metrics,content_type) VALUES('account-level-analytics',?1,?2,NULL,'account-history','2026-08-01','2026-08-01','2026-08-01T12:00:00Z',250,20,2,1,4,3,10.8,'{}','account_summary')",
                params![client, account_id],
            )
            .unwrap();
        let metrics_with_account_level_row = dashboard(
            &db,
            Some(client.clone()),
            None,
            None,
            "2020-01-01",
            "2030-01-01",
        )
        .unwrap();
        assert!(metrics_with_account_level_row.total_reach >= metrics.total_reach + 250);
        assert_eq!(metrics_with_account_level_row.top_posts.len(), 1);
        assert!(!metrics_with_account_level_row.top_posts[0]
            .post_id
            .is_empty());
        let prompt = analytics_prompt(&db, &client, "2020-01-01", "2030-01-01").unwrap();
        assert!(prompt.contains("valid JSON object"));
        let id = import_recommendations(
            &db,
            RecommendationInput {
                client_id: client.clone(),
                period_start: "2026-08-01".into(),
                period_end: "2026-08-31".into(),
                findings: vec!["Reels worked".into()],
                successful_topics: vec!["Education".into()],
                weak_topics: vec![],
                successful_formats: vec!["reel".into()],
                weak_formats: vec!["promo image".into()],
                posting_recommendations: vec!["4 weekly".into()],
                strategy_recommendations: vec!["Increase reels".into()],
                future_ideas: vec!["How-to reel".into()],
                raw_content: "analysis".into(),
            },
        )
        .unwrap();
        assert!(!id.is_empty());
        assert_eq!(list_recommendations(&db, Some(client)).unwrap().len(), 1);
    }
}
