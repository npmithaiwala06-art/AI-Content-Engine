pub mod facebook;
pub mod instagram;
pub mod mock;
pub mod twitter;
pub mod youtube;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlatformKind {
    Instagram,
    Facebook,
    Twitter,
    YouTube,
    Threads,
    TikTok,
    Pinterest,
    GoogleBusinessProfile,
    WhatsAppChannels,
}

#[derive(Debug, Clone)]
pub struct PublishRequest {
    pub post_id: String,
    pub account_id: String,
    pub title: Option<String>,
    pub caption: Option<String>,
    pub description: Option<String>,
    pub keywords: Vec<String>,
    pub media_paths: Vec<String>,
    pub platform_metadata: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublishResult {
    pub succeeded: bool,
    pub external_post_id: Option<String>,
    pub message: String,
}

pub trait PlatformAdapter: Send + Sync {
    fn platform(&self) -> PlatformKind;
    fn connect(&self) -> Result<(), String>;
    fn disconnect(&self) -> Result<(), String>;
    fn validate_connection(&self) -> Result<bool, String>;
    fn publish_post(&self, request: &PublishRequest) -> Result<PublishResult, String>;
    fn get_publish_status(&self, external_post_id: &str) -> Result<String, String>;
    fn fetch_analytics(&self, external_post_id: &str) -> Result<serde_json::Value, String>;
}

pub fn official_adapter(
    platform: &str,
    access_token: String,
    external_account_id: String,
    settings: Value,
) -> Result<Box<dyn PlatformAdapter>, String> {
    match platform {
        "instagram" => Ok(Box::new(instagram::InstagramAdapter::new(
            access_token,
            external_account_id,
            settings,
        ))),
        "facebook" => Ok(Box::new(facebook::FacebookAdapter::new(
            access_token,
            external_account_id,
            settings,
        ))),
        "twitter" => Ok(Box::new(twitter::TwitterAdapter::new(
            access_token,
            external_account_id,
            settings,
        ))),
        "youtube" => Ok(Box::new(youtube::YouTubeAdapter::new(
            access_token,
            external_account_id,
            settings,
        ))),
        _ => Err(format!("No official adapter for {platform}")),
    }
}

pub(crate) fn response_error(response: reqwest::blocking::Response) -> String {
    let status = response.status();
    let body = response
        .text()
        .unwrap_or_else(|_| "The platform returned an unreadable response".into());
    let detail = serde_json::from_str::<Value>(&body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/message")
                .or_else(|| value.pointer("/errors/0/detail"))
                .or_else(|| value.pointer("/errors/0/title"))
                .or_else(|| value.get("error_description"))
                .or_else(|| value.get("message"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or(body);
    format!("Platform request failed ({status}): {detail}")
}
