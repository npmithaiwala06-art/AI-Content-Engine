use crate::{analytics, database::Database, error::AppError};
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::fs;
use uuid::Uuid;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRecord {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub report_type: String,
    pub period_start: String,
    pub period_end: String,
    pub total_reach: i64,
    pub total_engagement: i64,
    pub best_platform: String,
    pub export_path: Option<String>,
    pub created_at: String,
}
pub fn create_report(
    database: &Database,
    client_id: &str,
    report_type: &str,
    start: &str,
    end: &str,
    campaign_id: Option<String>,
) -> Result<String, AppError> {
    if !["weekly", "monthly", "campaign", "platform", "client"].contains(&report_type) {
        return Err(AppError::Validation("Unsupported report type".into()));
    }
    let metrics = analytics::dashboard(
        database,
        Some(client_id.into()),
        None,
        campaign_id.clone(),
        start,
        end,
    )?;
    let prompt = analytics::analytics_prompt(database, client_id, start, end)?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    database.connection.lock().expect("database lock poisoned").execute("INSERT INTO reports(id,client_id,campaign_id,report_type,period_start,period_end,metrics_snapshot,analysis_prompt,created_at,updated_at)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",params![id,client_id,campaign_id,report_type,start,end,serde_json::to_string(&metrics)?,prompt,now])?;
    crate::automation::add_notification(
        database,
        "report_ready",
        "Report ready",
        &format!("Your {report_type} report is ready to review or export"),
        "report",
        &id,
    )?;
    Ok(id)
}
pub fn list_reports(
    database: &Database,
    client_id: Option<String>,
) -> Result<Vec<ReportRecord>, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let mut stmt=connection.prepare("SELECT r.id,r.client_id,c.name,r.report_type,r.period_start,r.period_end,COALESCE(json_extract(r.metrics_snapshot,'$.totalReach'),0),COALESCE(json_extract(r.metrics_snapshot,'$.totalEngagement'),0),COALESCE(json_extract(r.metrics_snapshot,'$.bestPlatform'),'—'),r.export_path,r.created_at FROM reports r JOIN clients c ON c.id=r.client_id WHERE r.status='ready' AND(?1 IS NULL OR r.client_id=?1)ORDER BY r.created_at DESC")?;
    let rows = stmt.query_map([client_id], |r| {
        Ok(ReportRecord {
            id: r.get(0)?,
            client_id: r.get(1)?,
            client_name: r.get(2)?,
            report_type: r.get(3)?,
            period_start: r.get(4)?,
            period_end: r.get(5)?,
            total_reach: r.get(6)?,
            total_engagement: r.get(7)?,
            best_platform: r.get(8)?,
            export_path: r.get(9)?,
            created_at: r.get(10)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
fn csv_escape(v: &str) -> String {
    format!("\"{}\"", v.replace('"', "\"\""))
}
fn pdf_escape(v: &str) -> String {
    v.replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
        .chars()
        .filter(|c| c.is_ascii())
        .collect()
}
fn text(content: &mut String, value: &str, x: f64, y: f64, size: f64, bold: bool, colour: &str) {
    content.push_str(&format!(
        "BT {colour} rg /{} {size:.1} Tf {x:.1} {y:.1} Td ({}) Tj ET\n",
        if bold { "F2" } else { "F1" },
        pdf_escape(value)
    ));
}

fn number(value: i64) -> String {
    let digits = value.abs().to_string();
    let mut grouped = String::new();
    for (index, character) in digits.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(character);
    }
    let mut result: String = grouped.chars().rev().collect();
    if value < 0 {
        result.insert(0, '-');
    }
    result
}

struct PdfReportData<'a> {
    client: &'a str,
    kind: &'a str,
    start: &'a str,
    end: &'a str,
    reach: i64,
    engagement: i64,
    followers: i64,
    best: &'a str,
    platforms: &'a [serde_json::Value],
}

fn build_pdf(data: PdfReportData<'_>) -> Vec<u8> {
    let PdfReportData {
        client,
        kind,
        start,
        end,
        reach,
        engagement,
        followers,
        best,
        platforms,
    } = data;
    let mut content = String::from("0.973 0.976 0.988 rg 0 0 612 792 re f\n");
    content.push_str("0.137 0.125 0.267 rg 0 674 612 118 re f\n");
    content.push_str("0.424 0.294 0.824 rg 0 674 8 118 re f\n");
    text(
        &mut content,
        "SOCIALFLOW OS",
        42.0,
        756.0,
        9.0,
        true,
        "0.76 0.72 0.93",
    );
    text(
        &mut content,
        &format!("{} REPORT", kind.to_uppercase()),
        42.0,
        728.0,
        22.0,
        true,
        "1 1 1",
    );
    text(
        &mut content,
        client,
        42.0,
        704.0,
        12.0,
        false,
        "0.90 0.89 0.96",
    );
    text(
        &mut content,
        &format!("{start} to {end}"),
        420.0,
        704.0,
        9.0,
        false,
        "0.82 0.80 0.91",
    );

    let cards = [
        ("TOTAL REACH", number(reach), "0.42 0.29 0.82"),
        ("ENGAGEMENT", number(engagement), "0.08 0.61 0.46"),
        ("FOLLOWERS GAINED", number(followers), "0.15 0.43 0.76"),
        ("BEST PLATFORM", best.to_uppercase(), "0.78 0.39 0.13"),
    ];
    for (index, (label, value, accent)) in cards.iter().enumerate() {
        let x = 36.0 + index as f64 * 137.0;
        content.push_str(&format!("1 1 1 rg {x:.1} 585 125 68 re f\n"));
        content.push_str(&format!("{accent} rg {x:.1} 585 4 68 re f\n"));
        text(
            &mut content,
            label,
            x + 13.0,
            628.0,
            7.0,
            true,
            "0.48 0.49 0.56",
        );
        let font_size = if value.len() > 13 { 11.0 } else { 17.0 };
        text(
            &mut content,
            value,
            x + 13.0,
            602.0,
            font_size,
            true,
            "0.20 0.21 0.27",
        );
    }

    text(
        &mut content,
        "PLATFORM PERFORMANCE",
        36.0,
        548.0,
        10.0,
        true,
        "0.25 0.26 0.33",
    );
    text(
        &mut content,
        "Reach and engagement rate from locally stored analytics",
        36.0,
        532.0,
        7.5,
        false,
        "0.53 0.55 0.62",
    );
    content.push_str("1 1 1 rg 36 300 540 214 re f\n");
    let maximum = platforms
        .iter()
        .filter_map(|platform| platform.get("reach").and_then(|value| value.as_i64()))
        .max()
        .unwrap_or(1)
        .max(1) as f64;
    for (index, platform) in platforms.iter().take(4).enumerate() {
        let name = platform
            .get("platform")
            .and_then(|value| value.as_str())
            .unwrap_or("platform");
        let platform_reach = platform
            .get("reach")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let rate = platform
            .get("engagementRate")
            .and_then(|value| value.as_f64())
            .unwrap_or(0.0);
        let y = 469.0 - index as f64 * 43.0;
        text(
            &mut content,
            &name.to_uppercase(),
            51.0,
            y + 9.0,
            7.5,
            true,
            "0.35 0.37 0.44",
        );
        content.push_str(&format!("0.93 0.93 0.96 rg 133 {y:.1} 326 13 re f\n"));
        let width = (platform_reach as f64 / maximum * 326.0).max(if platform_reach > 0 {
            4.0
        } else {
            0.0
        });
        content.push_str(&format!(
            "0.42 0.29 0.82 rg 133 {y:.1} {width:.1} 13 re f\n"
        ));
        text(
            &mut content,
            &number(platform_reach),
            470.0,
            y + 3.0,
            7.5,
            true,
            "0.28 0.29 0.35",
        );
        text(
            &mut content,
            &format!("{rate:.1}% engagement"),
            470.0,
            y - 9.0,
            6.5,
            false,
            "0.48 0.50 0.57",
        );
    }
    if platforms.is_empty() {
        text(
            &mut content,
            "No analytics collected for this period yet.",
            52.0,
            400.0,
            10.0,
            false,
            "0.55 0.57 0.64",
        );
    }

    content.push_str("0.93 0.95 0.98 rg 36 196 540 78 re f\n");
    text(
        &mut content,
        "NEXT STEP",
        52.0,
        249.0,
        7.0,
        true,
        "0.26 0.42 0.65",
    );
    text(
        &mut content,
        "Analyse with ChatGPT",
        52.0,
        227.0,
        13.0,
        true,
        "0.20 0.25 0.34",
    );
    text(
        &mut content,
        "Copy the analytics prompt, import recommendations, and improve the next content plan.",
        52.0,
        210.0,
        7.5,
        false,
        "0.43 0.47 0.55",
    );
    text(
        &mut content,
        "Generated locally on this Mac - no AI API key used",
        36.0,
        46.0,
        7.0,
        false,
        "0.55 0.57 0.63",
    );
    text(&mut content, "1", 566.0, 46.0, 7.0, true, "0.55 0.57 0.63");

    let objects=["<< /Type /Catalog /Pages 2 0 R >>".into(),"<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>".into(),"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".into(),"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".into(),format!("<< /Length {} >>\nstream\n{}\nendstream",content.len(),content)];
    let mut pdf = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0];
    for (i, obj) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", i + 1, obj).as_bytes());
    }
    let xref = pdf.len();
    pdf.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
    );
    for offset in offsets.iter().skip(1) {
        pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer << /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF",
            objects.len() + 1
        )
        .as_bytes(),
    );
    pdf
}
pub fn export_report(
    database: &Database,
    report_id: &str,
    format: &str,
) -> Result<String, AppError> {
    let (client, kind, start, end, metrics): (String, String, String, String, String) = {
        let connection = database.connection.lock().expect("database lock poisoned");
        connection.query_row("SELECT c.name,r.report_type,r.period_start,r.period_end,r.metrics_snapshot FROM reports r JOIN clients c ON c.id=r.client_id WHERE r.id=?1",[report_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional()?.ok_or_else(||AppError::NotFound("Report not found".into()))?
    };
    let value: serde_json::Value = serde_json::from_str(&metrics)?;
    let reach = value
        .get("totalReach")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let engagement = value
        .get("totalEngagement")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let followers = value
        .get("followersGained")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let best = value
        .get("bestPlatform")
        .and_then(|v| v.as_str())
        .unwrap_or("—");
    let folder = database.app_data_dir.join("reports");
    fs::create_dir_all(&folder)?;
    let safe = client
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>();
    let extension = if format == "csv" {
        "csv"
    } else if format == "pdf" {
        "pdf"
    } else {
        return Err(AppError::Validation(
            "Export format must be PDF or CSV".into(),
        ));
    };
    let path = folder.join(format!("{}-{}-{}.{}", safe, kind, start, extension));
    if format == "csv" {
        let csv=format!("Metric,Value\nClient,{}\nReport Type,{}\nPeriod,{} to {}\nTotal Reach,{}\nTotal Engagement,{}\nFollowers Gained,{}\nBest Platform,{}\n",csv_escape(&client),csv_escape(&kind),start,end,reach,engagement,followers,csv_escape(best));
        fs::write(&path, csv)?;
    } else {
        let platforms = value
            .get("platformComparison")
            .and_then(|item| item.as_array())
            .cloned()
            .unwrap_or_default();
        fs::write(
            &path,
            build_pdf(PdfReportData {
                client: &client,
                kind: &kind,
                start: &start,
                end: &end,
                reach,
                engagement,
                followers,
                best,
                platforms: &platforms,
            }),
        )?;
    }
    database
        .connection
        .lock()
        .expect("database lock poisoned")
        .execute(
            "UPDATE reports SET export_path=?2,updated_at=?3 WHERE id=?1",
            params![report_id, path.to_string_lossy(), Utc::now().to_rfc3339()],
        )?;
    Ok(path.to_string_lossy().into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{clients, database::Database};
    use rusqlite::Connection;
    use std::sync::Mutex;
    #[test]
    fn creates_and_exports_pdf_and_csv() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .unwrap();
        crate::database::apply_migrations(&connection).unwrap();
        let folder = std::env::temp_dir().join(format!("socialflow-reports-{}", Uuid::new_v4()));
        let db = Database {
            connection: Mutex::new(connection),
            app_data_dir: folder.clone(),
        };
        let client = clients::create_client(&db, clients::tests::input()).unwrap();
        let id = create_report(&db, &client, "monthly", "2026-08-01", "2026-08-31", None).unwrap();
        assert_eq!(list_reports(&db, None).unwrap().len(), 1);
        let pdf = export_report(&db, &id, "pdf").unwrap();
        let bytes = fs::read(pdf).unwrap();
        assert!(bytes.starts_with(b"%PDF-1.4"));
        assert!(String::from_utf8_lossy(&bytes).contains("xref"));
        let csv = export_report(&db, &id, "csv").unwrap();
        assert!(fs::read_to_string(csv).unwrap().contains("Total Reach"));
        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn professional_pdf_visual_fixture() {
        let platforms = vec![
            serde_json::json!({"platform":"instagram","reach":18400,"engagementRate":8.9}),
            serde_json::json!({"platform":"facebook","reach":9200,"engagementRate":4.7}),
            serde_json::json!({"platform":"linkedin","reach":6800,"engagementRate":6.2}),
            serde_json::json!({"platform":"youtube","reach":12100,"engagementRate":7.4}),
        ];
        let pdf = build_pdf(PdfReportData {
            client: "ABC Cafe",
            kind: "monthly",
            start: "2026-08-01",
            end: "2026-08-31",
            reach: 46_500,
            engagement: 3_860,
            followers: 214,
            best: "Instagram",
            platforms: &platforms,
        });
        assert!(String::from_utf8_lossy(&pdf).contains("PLATFORM PERFORMANCE"));
        if let Ok(path) = std::env::var("SOCIALFLOW_PDF_QA_PATH") {
            fs::write(path, pdf).unwrap();
        }
    }
}
