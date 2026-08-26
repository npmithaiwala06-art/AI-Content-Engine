use super::{response_error, PlatformAdapter, PlatformKind, PublishRequest, PublishResult};
use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE, LOCATION};
use serde_json::{json, Value};
use std::path::Path;
use url::Url;

fn validate_resumable_upload_url(value: &str) -> Result<String, String> {
    let url = Url::parse(value)
        .map_err(|_| "YouTube returned an invalid resumable upload URL".to_string())?;
    let allowed_host = matches!(
        url.host_str(),
        Some("www.googleapis.com" | "youtube.googleapis.com")
    );
    if url.scheme() != "https"
        || !allowed_host
        || !url.path().starts_with("/upload/youtube/v3/videos")
        || url.username() != ""
        || url.password().is_some()
    {
        return Err("YouTube returned an untrusted resumable upload URL".into());
    }
    Ok(url.into())
}

pub struct YouTubeAdapter {
    client: Client,
    access_token: String,
    channel_id: String,
    settings: Value,
}

impl YouTubeAdapter {
    pub fn new(access_token: String, channel_id: String, settings: Value) -> Self {
        Self {
            client: Client::new(),
            access_token,
            channel_id,
            settings,
        }
    }

    fn bearer(&self) -> String {
        format!("Bearer {}", self.access_token)
    }

    fn video_path<'a>(&self, request: &'a PublishRequest) -> Result<&'a Path, String> {
        request
            .media_paths
            .iter()
            .map(Path::new)
            .find(|path| {
                path.extension()
                    .and_then(|value| value.to_str())
                    .map(|value| {
                        matches!(
                            value.to_ascii_lowercase().as_str(),
                            "mp4" | "mov" | "m4v" | "webm"
                        )
                    })
                    .unwrap_or(false)
            })
            .ok_or_else(|| "YouTube publishing requires an attached video file".into())
    }

    fn upload_video(&self, request: &PublishRequest, path: &Path) -> Result<String, String> {
        let privacy = request
            .platform_metadata
            .get("privacy_status")
            .and_then(Value::as_str)
            .or_else(|| self.settings.get("privacy_status").and_then(Value::as_str))
            .unwrap_or("private");
        if !matches!(privacy, "private" | "unlisted" | "public") {
            return Err("YouTube privacy must be private, unlisted or public".into());
        }
        let bytes = std::fs::read(path)
            .map_err(|error| format!("Could not read the YouTube video: {error}"))?;
        let mime = match path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "mov" => "video/quicktime",
            "webm" => "video/webm",
            _ => "video/mp4",
        };
        let metadata = json!({
            "snippet": {
                "title": request.title.clone().filter(|value| !value.trim().is_empty()).unwrap_or_else(|| "Untitled SocialFlow upload".into()),
                "description": request.description.clone().or_else(|| request.caption.clone()).unwrap_or_default(),
                "tags": request.keywords,
                "categoryId": request.platform_metadata.get("category_id").and_then(Value::as_str).unwrap_or("22")
            },
            "status": {"privacyStatus": privacy}
        });
        let response = self
            .client
            .post("https://www.googleapis.com/upload/youtube/v3/videos")
            .query(&[("part", "snippet,status"), ("uploadType", "resumable")])
            .header(AUTHORIZATION, self.bearer())
            .header("X-Upload-Content-Length", bytes.len())
            .header("X-Upload-Content-Type", mime)
            .json(&metadata)
            .send()
            .map_err(|error| format!("Could not start the YouTube upload: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let location = response
            .headers()
            .get(LOCATION)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
            .ok_or_else(|| "YouTube did not return a resumable upload URL".to_string())?;
        let location = validate_resumable_upload_url(&location)?;
        let response = self
            .client
            .put(location)
            .header(AUTHORIZATION, self.bearer())
            .header(CONTENT_TYPE, mime)
            .header(CONTENT_LENGTH, bytes.len())
            .body(bytes)
            .send()
            .map_err(|error| format!("Could not upload the YouTube video: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("YouTube returned invalid upload JSON: {error}"))?;
        body.get("id")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| "YouTube did not return a video id".into())
    }

    fn upload_thumbnail(&self, video_id: &str, request: &PublishRequest) -> Result<(), String> {
        let Some(path) = request.media_paths.iter().map(Path::new).find(|path| {
            path.extension()
                .and_then(|value| value.to_str())
                .map(|value| matches!(value.to_ascii_lowercase().as_str(), "jpg" | "jpeg" | "png"))
                .unwrap_or(false)
        }) else {
            return Ok(());
        };
        let bytes = std::fs::read(path)
            .map_err(|error| format!("Could not read the YouTube thumbnail: {error}"))?;
        let mime = if path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .eq_ignore_ascii_case("png")
        {
            "image/png"
        } else {
            "image/jpeg"
        };
        let response = self
            .client
            .post("https://www.googleapis.com/upload/youtube/v3/thumbnails/set")
            .query(&[("videoId", video_id), ("uploadType", "media")])
            .header(AUTHORIZATION, self.bearer())
            .header(CONTENT_TYPE, mime)
            .header(CONTENT_LENGTH, bytes.len())
            .body(bytes)
            .send()
            .map_err(|error| format!("Could not upload the YouTube thumbnail: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        Ok(())
    }
}

impl PlatformAdapter for YouTubeAdapter {
    fn platform(&self) -> PlatformKind {
        PlatformKind::YouTube
    }
    fn connect(&self) -> Result<(), String> {
        self.validate_connection().and_then(|valid| {
            valid
                .then_some(())
                .ok_or_else(|| "YouTube rejected this channel authorization".into())
        })
    }
    fn disconnect(&self) -> Result<(), String> {
        Ok(())
    }
    fn validate_connection(&self) -> Result<bool, String> {
        let response = self
            .client
            .get("https://www.googleapis.com/youtube/v3/channels")
            .query(&[("part", "id,snippet"), ("mine", "true")])
            .header(AUTHORIZATION, self.bearer())
            .send()
            .map_err(|error| format!("Could not contact YouTube: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("YouTube returned invalid JSON: {error}"))?;
        let channels = body
            .get("items")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        Ok(channels.iter().any(|channel| {
            channel.get("id").and_then(Value::as_str) == Some(self.channel_id.as_str())
        }))
    }
    fn publish_post(&self, request: &PublishRequest) -> Result<PublishResult, String> {
        let video_id = self.upload_video(request, self.video_path(request)?)?;
        self.upload_thumbnail(&video_id, request)?;
        Ok(PublishResult {
            succeeded: true,
            external_post_id: Some(video_id),
            message: "Uploaded through the YouTube Data API".into(),
        })
    }
    fn get_publish_status(&self, external_post_id: &str) -> Result<String, String> {
        let response = self
            .client
            .get("https://www.googleapis.com/youtube/v3/videos")
            .query(&[("part", "status"), ("id", external_post_id)])
            .header(AUTHORIZATION, self.bearer())
            .send()
            .map_err(|error| format!("Could not check the YouTube video: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("YouTube returned invalid JSON: {error}"))?;
        let status = body
            .pointer("/items/0/status/uploadStatus")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        Ok(status.into())
    }
    fn fetch_analytics(&self, external_post_id: &str) -> Result<Value, String> {
        let response = self
            .client
            .get("https://www.googleapis.com/youtube/v3/videos")
            .query(&[("part", "statistics"), ("id", external_post_id)])
            .header(AUTHORIZATION, self.bearer())
            .send()
            .map_err(|error| format!("Could not fetch YouTube statistics: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        response
            .json()
            .map_err(|error| format!("YouTube returned invalid analytics JSON: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resumable_upload_url_must_be_https_on_google_upload_hosts() {
        assert!(validate_resumable_upload_url(
            "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc"
        )
        .is_ok());
        assert!(validate_resumable_upload_url(
            "https://youtube.googleapis.com/upload/youtube/v3/videos?upload_id=abc"
        )
        .is_ok());
        assert!(validate_resumable_upload_url(
            "http://www.googleapis.com/upload/youtube/v3/videos"
        )
        .is_err());
        assert!(
            validate_resumable_upload_url("https://attacker.example/upload?token=steal").is_err()
        );
        assert!(
            validate_resumable_upload_url("https://www.googleapis.com.evil.example/upload")
                .is_err()
        );
    }

    #[test]
    fn youtube_requires_an_attached_video() {
        let adapter = YouTubeAdapter::new("token".into(), "channel".into(), Value::Null);
        let request = PublishRequest {
            post_id: "post".into(),
            account_id: "account".into(),
            title: Some("Title".into()),
            caption: None,
            description: Some("Description".into()),
            keywords: vec![],
            media_paths: vec!["/tmp/thumbnail.png".into()],
            platform_metadata: json!({}),
        };
        assert!(adapter.video_path(&request).is_err());
    }
}
