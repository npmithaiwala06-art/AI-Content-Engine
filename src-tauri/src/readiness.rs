use crate::{database::Database, error::AppError};
use chrono::Utc;
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessCheck {
    pub id: String,
    pub label: String,
    pub status: String,
    pub detail: String,
    pub action_route: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseReadiness {
    pub phase: i64,
    pub title: String,
    pub status: String,
    pub summary: String,
    pub checks: Vec<ReadinessCheck>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseReadiness {
    pub app_version: String,
    pub generated_at: String,
    pub phases: Vec<PhaseReadiness>,
    pub complete_count: usize,
    pub remaining_count: usize,
    pub all_complete: bool,
}

fn scalar(connection: &rusqlite::Connection, sql: &str) -> Result<i64, AppError> {
    Ok(connection.query_row(sql, [], |row| row.get(0))?)
}

fn application_bundle(executable: &Path) -> Option<PathBuf> {
    executable
        .ancestors()
        .find(|path| path.extension().and_then(|value| value.to_str()) == Some("app"))
        .map(Path::to_path_buf)
}

fn command_text(command: &str, arguments: &[&str]) -> Option<(bool, String)> {
    Command::new(command)
        .args(arguments)
        .output()
        .ok()
        .map(|output| {
            let mut text = String::from_utf8_lossy(&output.stdout).to_string();
            text.push_str(&String::from_utf8_lossy(&output.stderr));
            (output.status.success(), text)
        })
}

fn apple_status(executable: &Path) -> (bool, bool, bool, String) {
    let Some(bundle) = application_bundle(executable) else {
        return (
            false,
            false,
            false,
            "Development executable is not inside an app bundle".into(),
        );
    };
    let path = bundle.to_string_lossy();
    let signature = command_text(
        "codesign",
        &["--verify", "--deep", "--strict", path.as_ref()],
    );
    let signed = signature.as_ref().map(|value| value.0).unwrap_or(false);
    let details = command_text("codesign", &["-dv", "--verbose=4", path.as_ref()]);
    let developer_id = details
        .as_ref()
        .map(|value| value.1.contains("Developer ID Application:"))
        .unwrap_or(false);
    let assessment = command_text("spctl", &["-a", "-vv", "-t", "exec", path.as_ref()]);
    let notarized = assessment
        .as_ref()
        .map(|value| {
            value
                .1
                .to_ascii_lowercase()
                .contains("notarized developer id")
        })
        .unwrap_or(false);
    let detail = if notarized {
        "Apple accepts this bundle as a notarized Developer ID application".into()
    } else if developer_id {
        "Developer ID signature found; Apple notarization is still required".into()
    } else if signed {
        "The bundle has an ad-hoc/local signature only".into()
    } else {
        "The running bundle is not code-signed".into()
    };
    (signed, developer_id, notarized, detail)
}

fn check(
    id: &str,
    label: &str,
    passed: bool,
    detail: String,
    action: Option<&str>,
) -> ReadinessCheck {
    ReadinessCheck {
        id: id.into(),
        label: label.into(),
        status: if passed { "passed" } else { "blocked" }.into(),
        detail,
        action_route: action.map(str::to_owned),
    }
}

fn phase(phase: i64, title: &str, checks: Vec<ReadinessCheck>) -> PhaseReadiness {
    let passed = checks.iter().all(|item| item.status == "passed");
    let passed_count = checks.iter().filter(|item| item.status == "passed").count();
    PhaseReadiness {
        phase,
        title: title.into(),
        status: if passed {
            "complete"
        } else {
            "needs_external_action"
        }
        .into(),
        summary: format!("{passed_count} of {} checks passed", checks.len()),
        checks,
    }
}

pub fn audit(database: &Database, executable: &Path) -> Result<ReleaseReadiness, AppError> {
    let connection = database.connection.lock().expect("database lock poisoned");
    let integrity: String = connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    let connected_platforms = scalar(&connection, "SELECT COUNT(DISTINCT platform_id) FROM social_accounts WHERE connection_status='connected'")?;
    let validated_platforms = scalar(&connection, "SELECT COUNT(DISTINCT platform_id) FROM social_accounts WHERE connection_status='connected' AND julianday(last_validated_at)>=julianday('now','-1 day') AND (token_expires_at IS NULL OR julianday(token_expires_at)>julianday('now'))")?;
    let real_published_platforms = scalar(&connection, "SELECT COUNT(DISTINCT pv.platform_id) FROM publishing_queue q JOIN schedules s ON s.id=q.schedule_id JOIN post_versions pv ON pv.id=s.post_version_id JOIN social_accounts sa ON sa.id=s.social_account_id WHERE q.status='published' AND sa.connection_status='connected' AND EXISTS(SELECT 1 FROM publishing_logs pl WHERE pl.schedule_id=s.id AND pl.status='succeeded' AND json_extract(pl.response_summary,'$.verified')=1)")?;
    let real_analytics_platforms = scalar(&connection, "SELECT COUNT(DISTINCT sa.platform_id) FROM analytics a JOIN social_accounts sa ON sa.id=a.social_account_id WHERE sa.connection_status='connected'")?;
    let duplicate_successes = scalar(&connection, "SELECT COUNT(*) FROM (SELECT schedule_id,COUNT(*) amount FROM publishing_logs WHERE status='succeeded' GROUP BY schedule_id HAVING amount>1)")?;
    drop(connection);
    let keychain = crate::security::status();
    let (signed, developer_id, notarized, apple_detail) = apple_status(executable);

    let phases = vec![
        phase(12, "Official social connections", vec![
            check("keychain", "macOS Keychain is available", keychain.keychain_available, keychain.detail, Some("/settings")),
            check("connected_platforms", "All four platforms are connected", connected_platforms >= 4, format!("{connected_platforms} of 4 platforms connected"), Some("/accounts")),
            check("validated_platforms", "All connected platforms validated within 24 hours", validated_platforms >= 4, format!("{validated_platforms} of 4 platforms have a current validation"), Some("/accounts")),
        ]),
        phase(35, "Live scheduler and publishing tests", vec![
            check("real_publish", "A real post was independently verified on every platform", real_published_platforms >= 4, format!("{real_published_platforms} of 4 platforms have a verified real publish"), Some("/publishing-queue")),
            check("real_analytics", "Real analytics collected from every platform", real_analytics_platforms >= 4, format!("{real_analytics_platforms} of 4 platforms have connected-account analytics"), Some("/analytics")),
            check("idempotency", "No schedule has duplicate success logs", duplicate_successes == 0, format!("{duplicate_successes} schedules contain duplicate success logs"), Some("/activity")),
        ]),
        phase(37, "Production macOS distribution", vec![
            check("signed", "Application bundle is code-signed", signed, apple_detail.clone(), None),
            check("developer_id", "Developer ID signature is present", developer_id, apple_detail.clone(), Some("/settings")),
            check("notarized", "Apple notarization is stapled and accepted", notarized, apple_detail, Some("/settings")),
        ]),
        phase(40, "Final product audit", vec![
            check("database", "SQLite integrity check passes", integrity == "ok", format!("SQLite returned: {integrity}"), Some("/settings")),
            check("external_phases", "External platform and distribution checks pass", connected_platforms >= 4 && validated_platforms >= 4 && real_published_platforms >= 4 && real_analytics_platforms >= 4 && developer_id && notarized, "Depends on completed Phases 12, 35 and 37".into(), None),
        ]),
    ];
    let complete_count = phases
        .iter()
        .filter(|item| item.status == "complete")
        .count();
    let remaining_count = phases.len() - complete_count;
    Ok(ReleaseReadiness {
        app_version: env!("CARGO_PKG_VERSION").into(),
        generated_at: Utc::now().to_rfc3339(),
        phases,
        complete_count,
        remaining_count,
        all_complete: remaining_count == 0,
    })
}

pub fn export(database: &Database, executable: &Path) -> Result<String, AppError> {
    let audit = audit(database, executable)?;
    let reports = database.app_data_dir.join("reports");
    std::fs::create_dir_all(&reports)?;
    let path = reports.join(format!(
        "release-readiness-{}.json",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    std::fs::write(&path, serde_json::to_vec_pretty(&audit)?)?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finds_a_parent_application_bundle() {
        assert_eq!(
            application_bundle(Path::new(
                "/Applications/SocialFlow OS.app/Contents/MacOS/socialflow-os"
            )),
            Some(PathBuf::from("/Applications/SocialFlow OS.app"))
        );
        assert!(application_bundle(Path::new("/tmp/socialflow-os")).is_none());
    }
}
