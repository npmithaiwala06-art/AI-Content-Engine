use super::{response_error, PlatformAdapter, PlatformKind, PublishRequest, PublishResult};
use reqwest::blocking::{multipart, Client};
use serde_json::Value;
use std::path::Path;

const GRAPH_VERSION: &str = "v23.0";

pub struct FacebookAdapter {
    client: Client,
    access_token: String,
    page_id: String,
    settings: Value,
}

impl FacebookAdapter {
    pub fn new(access_token: String, page_id: String, settings: Value) -> Self {
        Self {
            client: Client::new(),
            access_token,
            page_id,
            settings,
        }
    }

    fn graph_version(&self) -> &str {
        self.settings
            .get("graph_api_version")
            .and_then(Value::as_str)
            .unwrap_or(GRAPH_VERSION)
    }

    fn endpoint(&self, suffix: &str) -> String {
        format!(
            "https://graph.facebook.com/{}/{}/{}",
            self.graph_version(),
            self.page_id,
            suffix
        )
    }

    fn post_text(&self, message: &str) -> Result<PublishResult, String> {
        let response = self
            .client
            .post(self.endpoint("feed"))
            .form(&[("message", message), ("access_token", &self.access_token)])
            .send()
            .map_err(|error| format!("Could not contact Facebook: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Facebook returned invalid JSON: {error}"))?;
        let id = body
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Facebook did not return a post id".to_string())?;
        Ok(PublishResult {
            succeeded: true,
            external_post_id: Some(id.into()),
            message: "Published to the Facebook Page".into(),
        })
    }

    fn post_media(&self, request: &PublishRequest, path: &Path) -> Result<PublishResult, String> {
        let is_video = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| matches!(value.to_ascii_lowercase().as_str(), "mp4" | "mov" | "m4v"))
            .unwrap_or(false);
        let suffix = if is_video { "videos" } else { "photos" };
        let caption_key = if is_video { "description" } else { "caption" };
        let bytes = std::fs::read(path)
            .map_err(|error| format!("Could not read attached Facebook media: {error}"))?;
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("socialflow-media")
            .to_string();
        let form = multipart::Form::new()
            .text("access_token", self.access_token.clone())
            .text(caption_key, request.caption.clone().unwrap_or_default())
            .part("source", multipart::Part::bytes(bytes).file_name(file_name));
        let response = self
            .client
            .post(self.endpoint(suffix))
            .multipart(form)
            .send()
            .map_err(|error| format!("Could not upload Facebook media: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Facebook returned invalid JSON: {error}"))?;
        let id = body
            .get("post_id")
            .or_else(|| body.get("id"))
            .and_then(Value::as_str)
            .ok_or_else(|| "Facebook did not return a media post id".to_string())?;
        Ok(PublishResult {
            succeeded: true,
            external_post_id: Some(id.into()),
            message: format!("Published a {suffix} post to the Facebook Page"),
        })
    }
}

impl PlatformAdapter for FacebookAdapter {
    fn platform(&self) -> PlatformKind {
        PlatformKind::Facebook
    }
    fn connect(&self) -> Result<(), String> {
        self.validate_connection().and_then(|valid| {
            valid
                .then_some(())
                .ok_or_else(|| "Facebook rejected this Page token".into())
        })
    }
    fn disconnect(&self) -> Result<(), String> {
        Ok(())
    }
    fn validate_connection(&self) -> Result<bool, String> {
        let url = format!(
            "https://graph.facebook.com/{}/{}",
            self.graph_version(),
            self.page_id
        );
        let response = self
            .client
            .get(url)
            .query(&[
                ("fields", "id,name"),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .map_err(|error| format!("Could not contact Facebook: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Facebook returned invalid JSON: {error}"))?;
        Ok(body.get("id").and_then(Value::as_str) == Some(self.page_id.as_str()))
    }
    fn publish_post(&self, request: &PublishRequest) -> Result<PublishResult, String> {
        if let Some(path) = request.media_paths.first() {
            return self.post_media(request, Path::new(path));
        }
        let message = request
            .caption
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "Facebook text posts require a caption".to_string())?;
        self.post_text(message)
    }
    fn get_publish_status(&self, external_post_id: &str) -> Result<String, String> {
        let response = self
            .client
            .get(format!(
                "https://graph.facebook.com/{}/{}",
                self.graph_version(),
                external_post_id
            ))
            .query(&[
                ("fields", "id,is_published,permalink_url"),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .map_err(|error| format!("Could not check the Facebook post: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        Ok("published".into())
    }
    fn fetch_analytics(&self, external_post_id: &str) -> Result<Value, String> {
        let response = self
            .client
            .get(format!(
                "https://graph.facebook.com/{}/{}/insights",
                self.graph_version(),
                external_post_id
            ))
            .query(&[
                (
                    "metric",
                    "post_impressions,post_impressions_unique,post_clicks,post_engaged_users",
                ),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .map_err(|error| format!("Could not fetch Facebook analytics: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        response
            .json()
            .map_err(|error| format!("Facebook returned invalid analytics JSON: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoint_uses_configurable_graph_version() {
        let adapter = FacebookAdapter::new(
            "token".into(),
            "page".into(),
            serde_json::json!({"graph_api_version":"v99.0"}),
        );
        assert_eq!(
            adapter.endpoint("feed"),
            "https://graph.facebook.com/v99.0/page/feed"
        );
    }
}
