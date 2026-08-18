use crate::error::AppError;
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

const LABEL: &str = "com.socialflow.localos.scheduler";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundSchedulerStatus {
    pub supported: bool,
    pub installed: bool,
    pub loaded: bool,
    pub agent_path: String,
    pub executable_path: String,
    pub detail: String,
}

fn xml(value: &Path) -> String {
    value
        .to_string_lossy()
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn agent_path(home: &Path) -> PathBuf {
    home.join("Library")
        .join("LaunchAgents")
        .join(format!("{LABEL}.plist"))
}

fn user_domain() -> Result<String, AppError> {
    let output = Command::new("id").arg("-u").output()?;
    if !output.status.success() {
        return Err(AppError::Validation(
            "Could not determine the macOS user id".into(),
        ));
    }
    Ok(format!(
        "gui/{}",
        String::from_utf8_lossy(&output.stdout).trim()
    ))
}

fn loaded(domain: &str) -> bool {
    Command::new("launchctl")
        .args(["print", &format!("{domain}/{LABEL}")])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn plist(executable: &Path, database: &Path, stdout: &Path, stderr: &Path) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>{LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{}</string>
    <string>--scheduler-once</string>
    <string>{}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>{}</string>
  <key>StandardErrorPath</key><string>{}</string>
</dict>
</plist>
"#,
        xml(executable),
        xml(database),
        xml(stdout),
        xml(stderr)
    )
}

pub fn status(home: &Path, executable: &Path) -> Result<BackgroundSchedulerStatus, AppError> {
    let path = agent_path(home);
    let domain = user_domain()?;
    let is_loaded = loaded(&domain);
    let installed = path.exists();
    let detail = match (installed, is_loaded) {
        (true, true) => "Background scheduler checks due posts every 30 seconds, even when the app window is closed.",
        (true, false) => "The LaunchAgent file exists but is not loaded. Turn the setting off and on to repair it.",
        _ => "Background publishing is off. The in-app scheduler still runs while SocialFlow OS is open.",
    };
    Ok(BackgroundSchedulerStatus {
        supported: cfg!(target_os = "macos"),
        installed,
        loaded: is_loaded,
        agent_path: path.to_string_lossy().into(),
        executable_path: executable.to_string_lossy().into(),
        detail: detail.into(),
    })
}

pub fn set_enabled(
    home: &Path,
    app_data: &Path,
    executable: &Path,
    enabled: bool,
) -> Result<BackgroundSchedulerStatus, AppError> {
    let path = agent_path(home);
    let domain = user_domain()?;
    let target = format!("{domain}/{LABEL}");
    if enabled {
        let parent = path
            .parent()
            .ok_or_else(|| AppError::Validation("Invalid LaunchAgents folder".into()))?;
        fs::create_dir_all(parent)?;
        let logs = app_data.join("logs");
        fs::create_dir_all(&logs)?;
        let content = plist(
            executable,
            &app_data.join("socialflow.sqlite"),
            &logs.join("scheduler.log"),
            &logs.join("scheduler-error.log"),
        );
        fs::write(&path, content)?;
        let _ = Command::new("launchctl")
            .args(["bootout", &target])
            .status();
        let output = Command::new("launchctl")
            .args(["bootstrap", &domain, path.to_string_lossy().as_ref()])
            .output()?;
        if !output.status.success() {
            return Err(AppError::Validation(format!(
                "macOS could not start the background scheduler: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }
    } else {
        let _ = Command::new("launchctl")
            .args(["bootout", &target])
            .status();
        if path.exists() {
            fs::remove_file(&path)?;
        }
    }
    status(home, executable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_agent_runs_scheduler_only_and_escapes_paths() {
        let content = plist(
            Path::new("/Applications/SocialFlow & OS.app/worker"),
            Path::new("/tmp/socialflow.sqlite"),
            Path::new("/tmp/out.log"),
            Path::new("/tmp/error.log"),
        );
        assert!(content.contains("--scheduler-once"));
        assert!(content.contains("SocialFlow &amp; OS.app"));
        assert!(content.contains("StartInterval"));
    }
}
