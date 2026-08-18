use std::{path::PathBuf, process::Command};

use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiStatus {
    pub installed: bool,
    pub running: bool,
    pub provider: String,
    pub models: Vec<String>,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiResult {
    pub provider: String,
    pub model: String,
    pub content: String,
}

fn ollama_binary() -> Option<PathBuf> {
    [
        PathBuf::from("/opt/homebrew/bin/ollama"),
        PathBuf::from("/usr/local/bin/ollama"),
        PathBuf::from("ollama"),
    ]
    .into_iter()
    .find(|candidate| {
        if candidate.is_absolute() {
            candidate.is_file()
        } else {
            Command::new(candidate).arg("--version").output().is_ok()
        }
    })
}

fn installed_models(binary: &PathBuf) -> Result<Vec<String>, String> {
    let output = Command::new(binary)
        .arg("list")
        .output()
        .map_err(|error| format!("Could not start Ollama: {error}"))?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if error.is_empty() {
            "Ollama is installed but its local service is not running".into()
        } else {
            error
        });
    }
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text
        .lines()
        .skip(1)
        .filter_map(|line| line.split_whitespace().next())
        .filter(|model| !model.is_empty())
        .map(str::to_owned)
        .collect())
}

pub fn status() -> LocalAiStatus {
    let Some(binary) = ollama_binary() else {
        return LocalAiStatus {
            installed: false,
            running: false,
            provider: "Ollama local runtime".into(),
            models: vec![],
            detail:
                "No local LLM runtime is installed. Manual ChatGPT copy/import remains available."
                    .into(),
        };
    };
    match installed_models(&binary) {
        Ok(models) => LocalAiStatus {
            installed: true,
            running: true,
            provider: "Ollama local runtime".into(),
            detail: if models.is_empty() {
                "Ollama is running, but no local model has been downloaded.".into()
            } else {
                format!(
                    "{} local model(s) available. No AI API key is used.",
                    models.len()
                )
            },
            models,
        },
        Err(detail) => LocalAiStatus {
            installed: true,
            running: false,
            provider: "Ollama local runtime".into(),
            models: vec![],
            detail,
        },
    }
}

pub fn generate(model: &str, prompt: &str) -> Result<LocalAiResult, AppError> {
    let model = model.trim();
    let prompt = prompt.trim();
    if model.is_empty() {
        return Err(AppError::Validation(
            "Select an installed local model".into(),
        ));
    }
    if prompt.is_empty() || prompt.chars().count() > 60_000 {
        return Err(AppError::Validation(
            "The local LLM prompt must contain 1 to 60,000 characters".into(),
        ));
    }
    let binary = ollama_binary().ok_or_else(|| {
        AppError::Validation(
            "Ollama is not installed. Use the manual ChatGPT workflow or install a local runtime."
                .into(),
        )
    })?;
    let models = installed_models(&binary).map_err(AppError::Validation)?;
    if !models.iter().any(|installed| installed == model) {
        return Err(AppError::Validation(
            "The selected model is not installed locally".into(),
        ));
    }
    let output = Command::new(binary)
        .args(["run", model, prompt])
        .output()
        .map_err(|error| AppError::Validation(format!("Local LLM failed to start: {error}")))?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(AppError::Validation(if error.is_empty() {
            "Local LLM generation failed".into()
        } else {
            error
        }));
    }
    let content = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    if content.is_empty() {
        return Err(AppError::Validation(
            "The local model returned an empty response".into(),
        ));
    }
    Ok(LocalAiResult {
        provider: "ollama_local".into(),
        model: model.into(),
        content,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_generation_before_starting_a_model() {
        assert!(generate("", "prompt").is_err());
        assert!(generate("model", "").is_err());
        assert!(status().provider.contains("Ollama"));
    }
}
