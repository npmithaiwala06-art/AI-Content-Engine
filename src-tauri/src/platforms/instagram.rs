use super::{response_error, PlatformAdapter, PlatformKind, PublishRequest, PublishResult};
use reqwest::blocking::Client;
use serde_json::Value;
use std::{thread, time::Duration};

const GRAPH_VERSION: &str = "v23.0";

pub struct InstagramAdapter {
    client: Client,
    access_token: String,
    instagram_user_id: String,
    settings: Value,
}

impl InstagramAdapter {
    pub fn new(access_token: String, instagram_user_id: String, settings: Value) -> Self {
        Self {
            client: Client::new(),
            access_token,
            instagram_user_id,
            settings,
        }
    }

    fn graph_version(&self) -> &str {
        self.settings
            .get("graph_api_version")
            .and_then(Value::as_str)
            .unwrap_or(GRAPH_VERSION)
    }

    fn graph_url(&self, id: &str, suffix: &str) -> String {
        let tail = if suffix.is_empty() {
            String::new()
        } else {
            format!("/{suffix}")
        };
        format!(
            "https://graph.facebook.com/{}/{}{}",
            self.graph_version(),
            id,
            tail
        )
    }

    fn remote_media_url<'a>(&'a self, request: &'a PublishRequest) -> Option<&'a str> {
        request
            .platform_metadata
            .get("official_media_url")
            .and_then(Value::as_str)
            .or_else(|| {
                self.settings
                    .get("default_media_url")
                    .and_then(Value::as_str)
            })
    }

    fn wait_until_ready(&self, creation_id: &str) -> Result<(), String> {
        for _ in 0..20 {
            let response = self
                .client
                .get(self.graph_url(creation_id, ""))
                .query(&[
                    ("fields", "status_code,status"),
                    ("access_token", self.access_token.as_str()),
                ])
                .send()
                .map_err(|error| {
                    format!("Could not check the Instagram media container: {error}")
                })?;
            if !response.status().is_success() {
                return Err(response_error(response));
            }
            let body: Value = response.json().map_err(|error| {
                format!("Instagram returned invalid container status JSON: {error}")
            })?;
            match body
                .get("status_code")
                .and_then(Value::as_str)
                .unwrap_or("IN_PROGRESS")
            {
                "FINISHED" => return Ok(()),
                "ERROR" | "EXPIRED" => {
                    return Err(body
                        .get("status")
                        .and_then(Value::as_str)
                        .unwrap_or("Instagram could not process this media")
                        .to_string())
                }
                _ => thread::sleep(Duration::from_secs(3)),
            }
        }
        Err("Instagram media processing did not finish within 60 seconds; retry this queue item later".into())
    }
}

impl PlatformAdapter for InstagramAdapter {
    fn platform(&self) -> PlatformKind {
        PlatformKind::Instagram
    }
    fn connect(&self) -> Result<(), String> {
        self.validate_connection().and_then(|valid| {
            valid
                .then_some(())
                .ok_or_else(|| "Instagram rejected this professional-account token".into())
        })
    }
    fn disconnect(&self) -> Result<(), String> {
        Ok(())
    }
    fn validate_connection(&self) -> Result<bool, String> {
        let response = self
            .client
            .get(self.graph_url(&self.instagram_user_id, ""))
            .query(&[
                ("fields", "id,username,name"),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .map_err(|error| format!("Could not contact Instagram: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Instagram returned invalid JSON: {error}"))?;
        Ok(body.get("id").and_then(Value::as_str) == Some(self.instagram_user_id.as_str()))
    }
    fn publish_post(&self, request: &PublishRequest) -> Result<PublishResult, String> {
        let media_url = self.remote_media_url(request).ok_or_else(|| {
            "Instagram's official publishing API must fetch media from a public HTTPS URL. Add Official media URL to this Instagram version; the local file remains your source asset.".to_string()
        })?;
        if !media_url.starts_with("https://") {
            return Err("Instagram Official media URL must begin with https://".into());
        }
        let is_video = request
            .media_paths
            .first()
            .map(|path| {
                let lower = path.to_ascii_lowercase();
                lower.ends_with(".mp4") || lower.ends_with(".mov") || lower.ends_with(".m4v")
            })
            .unwrap_or_else(|| {
                let lower = media_url.to_ascii_lowercase();
                lower.contains(".mp4") || lower.contains(".mov")
            });
        let mut fields = vec![
            ("caption", request.caption.clone().unwrap_or_default()),
            ("access_token", self.access_token.clone()),
        ];
        if is_video {
            fields.push(("media_type", "REELS".into()));
            fields.push(("video_url", media_url.into()));
        } else {
            fields.push(("image_url", media_url.into()));
        }
        let response = self
            .client
            .post(self.graph_url(&self.instagram_user_id, "media"))
            .form(&fields)
            .send()
            .map_err(|error| format!("Could not create the Instagram media container: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Instagram returned invalid container JSON: {error}"))?;
        let creation_id = body
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Instagram did not return a creation id".to_string())?;
        if is_video {
            self.wait_until_ready(creation_id)?;
        }
        let response = self
            .client
            .post(self.graph_url(&self.instagram_user_id, "media_publish"))
            .form(&[
                ("creation_id", creation_id),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .map_err(|error| format!("Could not publish the Instagram media container: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Instagram returned invalid publish JSON: {error}"))?;
        let id = body
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Instagram did not return a media id".to_string())?;
        Ok(PublishResult {
            succeeded: true,
            external_post_id: Some(id.into()),
            message: "Published through the Instagram Content Publishing API".into(),
        })
    }
    fn get_publish_status(&self, external_post_id: &str) -> Result<String, String> {
        let response = self
            .client
            .get(self.graph_url(external_post_id, ""))
            .query(&[
                ("fields", "id,media_type,permalink,timestamp"),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .map_err(|error| format!("Could not check the Instagram media: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        Ok("published".into())
    }
    fn fetch_analytics(&self, external_post_id: &str) -> Result<Value, String> {
        let response = self
            .client
            .get(self.graph_url(external_post_id, "insights"))
            .query(&[
                (
                    "metric",
                    "reach,views,likes,comments,saved,shares,total_interactions",
                ),
                ("access_token", self.access_token.as_str()),
            ])
            .send()
            .map_err(|error| format!("Could not fetch Instagram insights: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        response
            .json()
            .map_err(|error| format!("Instagram returned invalid analytics JSON: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn local_file_alone_is_not_misrepresented_as_instagram_uploadable() {
        let adapter = InstagramAdapter::new("token".into(), "user".into(), Value::Null);
        let request = PublishRequest {
            post_id: "post".into(),
            account_id: "account".into(),
            title: None,
            caption: Some("Caption".into()),
            description: None,
            keywords: vec![],
            media_paths: vec!["/tmp/photo.jpg".into()],
            platform_metadata: serde_json::json!({}),
        };
        assert!(adapter.remote_media_url(&request).is_none());
    }
}
