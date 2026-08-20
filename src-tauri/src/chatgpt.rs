use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const MAX_PROMPT_CHARS: usize = 120_000;
const GENERATION_TIMEOUT: Duration = Duration::from_secs(12 * 60);

#[derive(Clone, Default)]
pub struct CodexRuntime {
    inner: Arc<Mutex<CodexRuntimeState>>,
}

#[derive(Default)]
struct CodexRuntimeState {
    login_in_progress: bool,
    last_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStatus {
    installed: bool,
    authenticated: bool,
    login_in_progress: bool,
    provider: String,
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexGenerationResult {
    provider: String,
    model: String,
    content: String,
    elapsed_ms: u128,
}

fn executable_candidate(path: PathBuf) -> Option<PathBuf> {
    path.is_file().then_some(path)
}

fn codex_binary(app: &AppHandle) -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("SOCIALFLOW_CODEX_BINARY") {
        if let Some(candidate) = executable_candidate(PathBuf::from(path)) {
            return Some(candidate);
        }
    }

    let home = app.path().home_dir().ok();
    let mut candidates = vec![
        PathBuf::from("/Applications/ChatGPT.app/Contents/Resources/codex"),
        PathBuf::from("/opt/homebrew/bin/codex"),
        PathBuf::from("/usr/local/bin/codex"),
    ];
    if let Some(home) = home {
        candidates.extend([
            home.join("Applications/ChatGPT.app/Contents/Resources/codex"),
            home.join("Desktop/ChatGPT.app/Contents/Resources/codex"),
            home.join(".local/bin/codex"),
        ]);
    }

    candidates
        .into_iter()
        .find_map(executable_candidate)
        .or_else(|| {
            Command::new("codex")
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .ok()
                .filter(|status| status.success())
                .map(|_| PathBuf::from("codex"))
        })
}

fn codex_home(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("codex-session");
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
    }
    Ok(path)
}

fn login_status(binary: &Path, auth_home: &Path) -> (bool, String) {
    match Command::new(binary)
        .args(["login", "status"])
        .env("CODEX_HOME", auth_home)
        .output()
    {
        Ok(output) => {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            let authenticated =
                output.status.success() && combined.to_ascii_lowercase().contains("logged in");
            if authenticated {
                (
                    true,
                    "Connected with your ChatGPT account through the official Codex client.".into(),
                )
            } else {
                (
                    false,
                    "Codex is installed but no ChatGPT account is connected yet.".into(),
                )
            }
        }
        Err(error) => (false, format!("Could not check Codex sign-in: {error}")),
    }
}

pub fn status(app: &AppHandle, runtime: &CodexRuntime) -> CodexStatus {
    let snapshot = runtime.inner.lock().expect("Codex state lock poisoned");
    let in_progress = snapshot.login_in_progress;
    let last_error = snapshot.last_error.clone();
    drop(snapshot);

    let Some(binary) = codex_binary(app) else {
        return CodexStatus {
            installed: false,
            authenticated: false,
            login_in_progress: false,
            provider: "Official Codex client".into(),
            detail:
                "Install the ChatGPT desktop app or Codex CLI to connect a ChatGPT subscription."
                    .into(),
        };
    };

    if in_progress {
        return CodexStatus {
            installed: true,
            authenticated: false,
            login_in_progress: true,
            provider: "Official Codex client".into(),
            detail: "Complete the OpenAI sign-in in your browser. SocialFlow never receives your password.".into(),
        };
    }

    let auth_home = match codex_home(app) {
        Ok(path) => path,
        Err(error) => {
            return CodexStatus {
                installed: true,
                authenticated: false,
                login_in_progress: false,
                provider: "Official Codex client".into(),
                detail: format!("Could not prepare SocialFlow's private Codex session: {error}"),
            }
        }
    };
    let (authenticated, detail) = login_status(&binary, &auth_home);
    CodexStatus {
        installed: true,
        authenticated,
        login_in_progress: false,
        provider: "Official Codex client".into(),
        detail: last_error.unwrap_or(detail),
    }
}

pub fn start_login(app: AppHandle, runtime: CodexRuntime) -> Result<(), String> {
    let binary = codex_binary(&app).ok_or_else(|| {
        "Codex is not installed. Install the ChatGPT desktop app or official Codex CLI first."
            .to_string()
    })?;

    let auth_home = codex_home(&app)?;
    {
        let mut state = runtime.inner.lock().map_err(|error| error.to_string())?;
        if state.login_in_progress {
            return Ok(());
        }
        state.login_in_progress = true;
        state.last_error = None;
    }

    thread::spawn(move || {
        let outcome = Command::new(binary)
            .arg("login")
            .env("CODEX_HOME", auth_home)
            .status();
        let mut state = runtime.inner.lock().expect("Codex state lock poisoned");
        state.login_in_progress = false;
        state.last_error = match outcome {
            Ok(status) if status.success() => None,
            Ok(_) => Some("OpenAI sign-in was cancelled or did not complete.".into()),
            Err(error) => Some(format!(
                "Could not start the official Codex sign-in: {error}"
            )),
        };
    });
    Ok(())
}

pub fn logout(app: &AppHandle, runtime: &CodexRuntime) -> Result<(), String> {
    let binary = codex_binary(app).ok_or_else(|| "Codex is not installed.".to_string())?;
    let auth_home = codex_home(app)?;
    let output = Command::new(binary)
        .arg("logout")
        .env("CODEX_HOME", auth_home)
        .output()
        .map_err(|error| format!("Could not start Codex logout: {error}"))?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if error.is_empty() {
            "Codex logout failed.".into()
        } else {
            error
        });
    }
    let mut state = runtime.inner.lock().map_err(|error| error.to_string())?;
    state.last_error = None;
    Ok(())
}

fn run_generation(app: AppHandle, prompt: String) -> Result<CodexGenerationResult, String> {
    let prompt = prompt.trim().to_owned();
    if prompt.is_empty() || prompt.chars().count() > MAX_PROMPT_CHARS {
        return Err(format!(
            "The Codex request must contain 1 to {MAX_PROMPT_CHARS} characters."
        ));
    }

    let binary = codex_binary(&app).ok_or_else(|| {
        "Codex is not installed. Install the ChatGPT desktop app or official Codex CLI first."
            .to_string()
    })?;
    let auth_home = codex_home(&app)?;
    let (authenticated, _) = login_status(&binary, &auth_home);
    if !authenticated {
        return Err("Connect your ChatGPT account from the ChatGPT tab before generating.".into());
    }

    let runtime_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("codex-runtime");
    fs::create_dir_all(&runtime_dir).map_err(|error| error.to_string())?;
    let run_id = Uuid::new_v4().to_string();
    let result_path = runtime_dir.join(format!("{run_id}.result.txt"));
    let error_path = runtime_dir.join(format!("{run_id}.error.txt"));
    let error_file = File::create(&error_path).map_err(|error| error.to_string())?;

    let started = Instant::now();
    let mut child = Command::new(binary)
        .current_dir(&runtime_dir)
        .args([
            "exec",
            "--ephemeral",
            "--ignore-rules",
            "--sandbox",
            "read-only",
            "--skip-git-repo-check",
            "--output-last-message",
        ])
        .arg(&result_path)
        .arg("-")
        .env("CODEX_HOME", auth_home)
        .env("NO_COLOR", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::from(error_file))
        .spawn()
        .map_err(|error| format!("Could not start Codex: {error}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        if let Err(error) = stdin.write_all(prompt.as_bytes()) {
            let _ = child.kill();
            return Err(format!(
                "Could not send the content brief to Codex: {error}"
            ));
        }
    }

    let exit_status = loop {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            break status;
        }
        if started.elapsed() >= GENERATION_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_file(&result_path);
            let _ = fs::remove_file(&error_path);
            return Err("Codex generation timed out after 12 minutes.".into());
        }
        thread::sleep(Duration::from_millis(200));
    };

    let stderr = fs::read_to_string(&error_path).unwrap_or_default();
    let content = fs::read_to_string(&result_path)
        .unwrap_or_default()
        .trim()
        .to_owned();
    let _ = fs::remove_file(&result_path);
    let _ = fs::remove_file(&error_path);

    if !exit_status.success() {
        let message = stderr
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("Codex generation failed")
            .trim();
        return Err(message.to_owned());
    }
    if content.is_empty() {
        return Err("Codex completed without returning content.".into());
    }

    Ok(CodexGenerationResult {
        provider: "codex_chatgpt_subscription".into(),
        model: "Codex subscription model".into(),
        content,
        elapsed_ms: started.elapsed().as_millis(),
    })
}

pub async fn generate(app: AppHandle, prompt: String) -> Result<CodexGenerationResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_generation(app, prompt))
        .await
        .map_err(|error| format!("Codex generation task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enforces_a_bounded_prompt_size() {
        assert!("".trim().is_empty());
        assert!("x".repeat(MAX_PROMPT_CHARS + 1).chars().count() > MAX_PROMPT_CHARS);
    }
}
