use super::{response_error, PlatformAdapter, PlatformKind, PublishRequest, PublishResult};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::blocking::{multipart, Client};
use reqwest::header::AUTHORIZATION;
use serde_json::{json, Value};
use std::{fs::File, io::Read, path::Path, thread, time::Duration};

const API_ROOT: &str = "https://api.x.com/2";
const STANDARD_POST_LIMIT: usize = 280;
const IMAGE_LIMIT_BYTES: u64 = 5 * 1024 * 1024;
const GIF_LIMIT_BYTES: u64 = 15 * 1024 * 1024;
const VIDEO_LIMIT_BYTES: u64 = 512 * 1024 * 1024;
const VIDEO_CHUNK_BYTES: usize = 4 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TwitterMediaKind {
    Image,
    Gif,
    Video,
}

pub struct TwitterAdapter {
    client: Client,
    access_token: String,
    user_id: String,
}

impl TwitterAdapter {
    pub fn new(access_token: String, user_id: String, _settings: Value) -> Self {
        Self {
            client: Client::new(),
            access_token,
            user_id,
        }
    }

    fn bearer(&self) -> String {
        format!("Bearer {}", self.access_token)
    }

    fn authorized(
        &self,
        request: reqwest::blocking::RequestBuilder,
    ) -> reqwest::blocking::RequestBuilder {
        request.header(AUTHORIZATION, self.bearer())
    }

    fn post_text(request: &PublishRequest) -> String {
        request
            .caption
            .clone()
            .unwrap_or_default()
            .trim()
            .to_owned()
    }

    fn validate_request(request: &PublishRequest) -> Result<(), String> {
        let post_text = Self::post_text(request);
        if post_text.is_empty() && request.media_paths.is_empty() {
            return Err("Twitter posts require text or attached media".into());
        }
        if post_text.chars().count() > STANDARD_POST_LIMIT {
            return Err(format!(
                "Twitter post text must be {STANDARD_POST_LIMIT} characters or fewer; shorten this platform version before publishing"
            ));
        }
        let kinds = request
            .media_paths
            .iter()
            .map(|path| Self::media_descriptor(Path::new(path)).map(|value| value.0))
            .collect::<Result<Vec<_>, _>>()?;
        let videos = kinds
            .iter()
            .filter(|kind| **kind == TwitterMediaKind::Video)
            .count();
        let gifs = kinds
            .iter()
            .filter(|kind| **kind == TwitterMediaKind::Gif)
            .count();
        if videos > 0 && (videos != 1 || kinds.len() != 1) {
            return Err(
                "Twitter posts support one video without additional image attachments".into(),
            );
        }
        if gifs > 0 && (gifs != 1 || kinds.len() != 1) {
            return Err(
                "Twitter posts support one animated GIF without additional attachments".into(),
            );
        }
        if kinds.len() > 4 {
            return Err("Twitter supports up to four attached images per post".into());
        }
        Ok(())
    }

    fn media_descriptor(
        path: &Path,
    ) -> Result<(TwitterMediaKind, &'static str, &'static str, u64), String> {
        let (kind, mime, category, limit) = match path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "jpg" | "jpeg" => (
                TwitterMediaKind::Image,
                "image/jpeg",
                "tweet_image",
                IMAGE_LIMIT_BYTES,
            ),
            "png" => (
                TwitterMediaKind::Image,
                "image/png",
                "tweet_image",
                IMAGE_LIMIT_BYTES,
            ),
            "webp" => (
                TwitterMediaKind::Image,
                "image/webp",
                "tweet_image",
                IMAGE_LIMIT_BYTES,
            ),
            "bmp" => (
                TwitterMediaKind::Image,
                "image/bmp",
                "tweet_image",
                IMAGE_LIMIT_BYTES,
            ),
            "gif" => (
                TwitterMediaKind::Gif,
                "image/gif",
                "tweet_gif",
                GIF_LIMIT_BYTES,
            ),
            "mp4" | "m4v" => (
                TwitterMediaKind::Video,
                "video/mp4",
                "tweet_video",
                VIDEO_LIMIT_BYTES,
            ),
            "mov" => (
                TwitterMediaKind::Video,
                "video/quicktime",
                "tweet_video",
                VIDEO_LIMIT_BYTES,
            ),
            _ => {
                return Err(
                    "Twitter supports JPG, PNG, WebP, BMP, GIF, MP4, M4V or MOV attachments".into(),
                )
            }
        };
        let size = std::fs::metadata(path)
            .map_err(|error| format!("Could not inspect the Twitter media file: {error}"))?
            .len();
        if size == 0 {
            return Err("Twitter media files cannot be empty".into());
        }
        if size > limit {
            return Err(format!(
                "Twitter media file {} exceeds the {} MB limit for this format",
                path.display(),
                limit / 1024 / 1024
            ));
        }
        Ok((kind, mime, category, size))
    }

    fn upload_image(&self, path: &Path) -> Result<String, String> {
        let (_, mime, category, _) = Self::media_descriptor(path)?;
        let bytes = std::fs::read(path)
            .map_err(|error| format!("Could not read the Twitter image: {error}"))?;
        let response = self
            .authorized(self.client.post(format!("{API_ROOT}/media/upload")))
            .json(&json!({
                "media": STANDARD.encode(bytes),
                "media_category": category,
                "media_type": mime,
                "shared": false
            }))
            .send()
            .map_err(|error| format!("Could not upload Twitter media: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Twitter returned invalid media JSON: {error}"))?;
        body.pointer("/data/id")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| "Twitter did not return a media ID".into())
    }

    fn upload_video(&self, path: &Path) -> Result<String, String> {
        let (kind, mime, category, total_bytes) = Self::media_descriptor(path)?;
        if kind != TwitterMediaKind::Video {
            return Err("Twitter chunked upload expected a video file".into());
        }
        let init = multipart::Form::new()
            .text("command", "INIT")
            .text("media_type", mime.to_owned())
            .text("total_bytes", total_bytes.to_string())
            .text("media_category", category.to_owned());
        let response = self
            .authorized(self.client.post(format!("{API_ROOT}/media/upload")))
            .multipart(init)
            .send()
            .map_err(|error| format!("Could not initialize Twitter video upload: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response.json().map_err(|error| {
            format!("Twitter returned invalid upload initialization JSON: {error}")
        })?;
        let media_id = body
            .pointer("/data/id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Twitter did not return a video media ID".to_string())?
            .to_owned();

        let mut file = File::open(path)
            .map_err(|error| format!("Could not open the Twitter video: {error}"))?;
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("video.mp4")
            .to_owned();
        let mut segment_index = 0;
        loop {
            let mut chunk = vec![0_u8; VIDEO_CHUNK_BYTES];
            let read = file
                .read(&mut chunk)
                .map_err(|error| format!("Could not read the Twitter video chunk: {error}"))?;
            if read == 0 {
                break;
            }
            chunk.truncate(read);
            let part = multipart::Part::bytes(chunk)
                .file_name(file_name.clone())
                .mime_str("application/octet-stream")
                .map_err(|error| format!("Could not prepare the Twitter video chunk: {error}"))?;
            let append = multipart::Form::new()
                .text("command", "APPEND")
                .text("media_id", media_id.clone())
                .text("segment_index", segment_index.to_string())
                .part("media", part);
            let response = self
                .authorized(self.client.post(format!("{API_ROOT}/media/upload")))
                .multipart(append)
                .send()
                .map_err(|error| {
                    format!("Could not upload Twitter video segment {segment_index}: {error}")
                })?;
            if !response.status().is_success() {
                return Err(response_error(response));
            }
            segment_index += 1;
        }

        let finalize = multipart::Form::new()
            .text("command", "FINALIZE")
            .text("media_id", media_id.clone());
        let response = self
            .authorized(self.client.post(format!("{API_ROOT}/media/upload")))
            .multipart(finalize)
            .send()
            .map_err(|error| format!("Could not finalize Twitter video upload: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Twitter returned invalid upload completion JSON: {error}"))?;
        self.wait_for_media_processing(&media_id, body)?;
        Ok(media_id)
    }

    fn wait_for_media_processing(&self, media_id: &str, mut body: Value) -> Result<(), String> {
        for _ in 0..30 {
            let state = body
                .pointer("/data/processing_info/state")
                .and_then(Value::as_str);
            match state {
                None | Some("succeeded") => return Ok(()),
                Some("failed") => {
                    let detail = body
                        .pointer("/data/processing_info/error/message")
                        .and_then(Value::as_str)
                        .unwrap_or("Twitter could not process the uploaded video");
                    return Err(detail.to_owned());
                }
                Some("pending" | "in_progress") => {
                    let delay = body
                        .pointer("/data/processing_info/check_after_secs")
                        .and_then(Value::as_u64)
                        .unwrap_or(1)
                        .clamp(1, 5);
                    thread::sleep(Duration::from_secs(delay));
                    let response = self
                        .authorized(self.client.get(format!("{API_ROOT}/media/upload")))
                        .query(&[("command", "STATUS"), ("media_id", media_id)])
                        .send()
                        .map_err(|error| {
                            format!("Could not check Twitter video processing: {error}")
                        })?;
                    if !response.status().is_success() {
                        return Err(response_error(response));
                    }
                    body = response.json().map_err(|error| {
                        format!("Twitter returned invalid processing JSON: {error}")
                    })?;
                }
                Some(other) => return Err(format!("Twitter returned unknown media state {other}")),
            }
        }
        Err("Twitter video processing did not finish within the expected time".into())
    }

    fn upload_media(&self, path: &Path) -> Result<String, String> {
        let (kind, _, _, _) = Self::media_descriptor(path)?;
        match kind {
            TwitterMediaKind::Image | TwitterMediaKind::Gif => self.upload_image(path),
            TwitterMediaKind::Video => self.upload_video(path),
        }
    }

    fn create_body(request: &PublishRequest, media_ids: Vec<String>) -> Value {
        let text = Self::post_text(request);
        let mut body = json!({});
        if !text.is_empty() {
            body["text"] = Value::String(text);
        }
        if !media_ids.is_empty() {
            body["media"] = json!({ "media_ids": media_ids });
        }
        body
    }

    fn fetch_post(&self, post_id: &str) -> Result<Value, String> {
        let response = self
            .authorized(self.client.get(format!("{API_ROOT}/tweets/{post_id}")))
            .query(&[(
                "tweet.fields",
                "created_at,public_metrics,non_public_metrics,organic_metrics",
            )])
            .send()
            .map_err(|error| format!("Could not read the Twitter post: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        response
            .json()
            .map_err(|error| format!("Twitter returned invalid post JSON: {error}"))
    }
}

impl PlatformAdapter for TwitterAdapter {
    fn platform(&self) -> PlatformKind {
        PlatformKind::Twitter
    }

    fn connect(&self) -> Result<(), String> {
        self.validate_connection().and_then(|valid| {
            valid
                .then_some(())
                .ok_or_else(|| "Twitter rejected this user authorization".into())
        })
    }

    fn disconnect(&self) -> Result<(), String> {
        Ok(())
    }

    fn validate_connection(&self) -> Result<bool, String> {
        let response = self
            .authorized(self.client.get(format!("{API_ROOT}/users/me")))
            .send()
            .map_err(|error| format!("Could not contact Twitter: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Twitter returned invalid user JSON: {error}"))?;
        Ok(body.pointer("/data/id").and_then(Value::as_str) == Some(self.user_id.as_str()))
    }

    fn publish_post(&self, request: &PublishRequest) -> Result<PublishResult, String> {
        Self::validate_request(request)?;
        let media_ids = request
            .media_paths
            .iter()
            .map(|path| self.upload_media(Path::new(path)))
            .collect::<Result<Vec<_>, _>>()?;
        let response = self
            .authorized(self.client.post(format!("{API_ROOT}/tweets")))
            .json(&Self::create_body(request, media_ids))
            .send()
            .map_err(|error| format!("Could not publish to Twitter: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("Twitter returned invalid publish JSON: {error}"))?;
        let id = body
            .pointer("/data/id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Twitter did not return a post ID".to_string())?;
        Ok(PublishResult {
            succeeded: true,
            external_post_id: Some(id.into()),
            message: "Published through the official X API".into(),
        })
    }

    fn get_publish_status(&self, external_post_id: &str) -> Result<String, String> {
        let body = self.fetch_post(external_post_id)?;
        if body.pointer("/data/id").and_then(Value::as_str) == Some(external_post_id) {
            Ok("published".into())
        } else {
            Ok("unknown".into())
        }
    }

    fn fetch_analytics(&self, external_post_id: &str) -> Result<Value, String> {
        self.fetch_post(external_post_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(caption: &str, media_paths: Vec<String>) -> PublishRequest {
        PublishRequest {
            post_id: "post".into(),
            account_id: "account".into(),
            title: None,
            caption: Some(caption.into()),
            description: None,
            keywords: vec![],
            media_paths,
            platform_metadata: json!({}),
        }
    }

    #[test]
    fn builds_text_and_media_post_body() {
        let body = TwitterAdapter::create_body(
            &request("Launch day", vec!["creative.png".into()]),
            vec!["123".into()],
        );
        assert_eq!(body["text"], "Launch day");
        assert_eq!(body["media"]["media_ids"][0], "123");
    }

    #[test]
    fn rejects_posts_over_the_standard_limit() {
        let result = TwitterAdapter::validate_request(&request(&"x".repeat(281), vec![]));
        assert!(result.is_err());
    }

    #[test]
    fn accepts_one_video_and_rejects_mixed_video_media() {
        let temp = std::env::temp_dir().join(format!("twitter-video-{}.mp4", uuid::Uuid::new_v4()));
        std::fs::write(&temp, [0_u8; 32]).unwrap();
        let valid = request("Video", vec![temp.to_string_lossy().into_owned()]);
        assert!(TwitterAdapter::validate_request(&valid).is_ok());
        let mixed = request(
            "Mixed",
            vec![
                temp.to_string_lossy().into_owned(),
                temp.to_string_lossy().into_owned(),
            ],
        );
        assert!(TwitterAdapter::validate_request(&mixed).is_err());
        let _ = std::fs::remove_file(temp);
    }
}
