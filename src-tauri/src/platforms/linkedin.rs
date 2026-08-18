use super::{response_error, PlatformAdapter, PlatformKind, PublishRequest, PublishResult};
use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};
use std::path::Path;

const LINKEDIN_VERSION: &str = "202601";

pub struct LinkedInAdapter {
    client: Client,
    access_token: String,
    author_urn: String,
    settings: Value,
}

impl LinkedInAdapter {
    pub fn new(access_token: String, author_urn: String, settings: Value) -> Self {
        Self {
            client: Client::new(),
            access_token,
            author_urn,
            settings,
        }
    }

    fn version(&self) -> &str {
        self.settings
            .get("linkedin_version")
            .and_then(Value::as_str)
            .unwrap_or(LINKEDIN_VERSION)
    }

    fn bearer(&self) -> String {
        format!("Bearer {}", self.access_token)
    }

    fn base_request(
        &self,
        request: reqwest::blocking::RequestBuilder,
    ) -> reqwest::blocking::RequestBuilder {
        request
            .header(AUTHORIZATION, self.bearer())
            .header("Linkedin-Version", self.version())
            .header("X-Restli-Protocol-Version", "2.0.0")
    }

    fn upload_image(&self, path: &Path) -> Result<String, String> {
        let init_body = json!({"initializeUploadRequest":{"owner":self.author_urn}});
        let response = self
            .base_request(
                self.client
                    .post("https://api.linkedin.com/rest/images?action=initializeUpload"),
            )
            .json(&init_body)
            .send()
            .map_err(|error| format!("Could not initialize LinkedIn image upload: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let body: Value = response
            .json()
            .map_err(|error| format!("LinkedIn returned invalid upload JSON: {error}"))?;
        let upload_url = body
            .pointer("/value/uploadUrl")
            .and_then(Value::as_str)
            .ok_or_else(|| "LinkedIn did not return an image upload URL".to_string())?;
        let image_urn = body
            .pointer("/value/image")
            .and_then(Value::as_str)
            .ok_or_else(|| "LinkedIn did not return an image URN".to_string())?;
        let bytes = std::fs::read(path)
            .map_err(|error| format!("Could not read the LinkedIn image: {error}"))?;
        let response = self
            .client
            .put(upload_url)
            .header(AUTHORIZATION, self.bearer())
            .header(CONTENT_TYPE, "application/octet-stream")
            .body(bytes)
            .send()
            .map_err(|error| format!("Could not upload the LinkedIn image: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        Ok(image_urn.into())
    }

    fn post_body(&self, request: &PublishRequest, image_urn: Option<String>) -> Value {
        let mut body = json!({
            "author": self.author_urn,
            "commentary": request.caption.clone().unwrap_or_default(),
            "visibility": "PUBLIC",
            "distribution": {"feedDistribution":"MAIN_FEED","targetEntities":[],"thirdPartyDistributionChannels":[]},
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": false
        });
        if let Some(image_urn) = image_urn {
            body["content"] = json!({"media":{"id":image_urn,"altText":request.title.clone().unwrap_or_else(|| "Social media image".into())}});
        }
        body
    }
}

impl PlatformAdapter for LinkedInAdapter {
    fn platform(&self) -> PlatformKind {
        PlatformKind::LinkedIn
    }
    fn connect(&self) -> Result<(), String> {
        self.validate_connection().and_then(|valid| {
            valid
                .then_some(())
                .ok_or_else(|| "LinkedIn rejected this access token".into())
        })
    }
    fn disconnect(&self) -> Result<(), String> {
        Ok(())
    }
    fn validate_connection(&self) -> Result<bool, String> {
        if !(self.author_urn.starts_with("urn:li:person:")
            || self.author_urn.starts_with("urn:li:organization:"))
        {
            return Err("LinkedIn Account ID must be a person or organization URN".into());
        }
        let response = self
            .client
            .get("https://api.linkedin.com/v2/userinfo")
            .header(AUTHORIZATION, self.bearer())
            .send()
            .map_err(|error| format!("Could not contact LinkedIn: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        Ok(true)
    }
    fn publish_post(&self, request: &PublishRequest) -> Result<PublishResult, String> {
        let image = if let Some(path) = request.media_paths.first() {
            let path = Path::new(path);
            let lower = path
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            if matches!(lower.as_str(), "mp4" | "mov" | "m4v") {
                return Err("LinkedIn video publishing needs its multi-part Videos API workflow. Use an image or text post in this release.".into());
            }
            Some(self.upload_image(path)?)
        } else {
            None
        };
        let response = self
            .base_request(self.client.post("https://api.linkedin.com/rest/posts"))
            .json(&self.post_body(request, image))
            .send()
            .map_err(|error| format!("Could not publish to LinkedIn: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        let id = response
            .headers()
            .get("x-restli-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
            .ok_or_else(|| {
                "LinkedIn published the request but did not return x-restli-id".to_string()
            })?;
        Ok(PublishResult {
            succeeded: true,
            external_post_id: Some(id),
            message: "Published through the LinkedIn Posts API".into(),
        })
    }
    fn get_publish_status(&self, external_post_id: &str) -> Result<String, String> {
        let encoded = urlencoding::encode(external_post_id);
        let response = self
            .base_request(
                self.client
                    .get(format!("https://api.linkedin.com/rest/posts/{encoded}")),
            )
            .send()
            .map_err(|error| format!("Could not check the LinkedIn post: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        Ok("published".into())
    }
    fn fetch_analytics(&self, external_post_id: &str) -> Result<Value, String> {
        let encoded = urlencoding::encode(external_post_id);
        let response = self
            .base_request(self.client.get(format!(
                "https://api.linkedin.com/rest/socialActions/{encoded}"
            )))
            .send()
            .map_err(|error| format!("Could not fetch LinkedIn social actions: {error}"))?;
        if !response.status().is_success() {
            return Err(response_error(response));
        }
        response
            .json()
            .map_err(|error| format!("LinkedIn returned invalid analytics JSON: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn post_body_keeps_author_and_commentary_separate() {
        let adapter = LinkedInAdapter::new(
            "token".into(),
            "urn:li:organization:123".into(),
            Value::Null,
        );
        let request = PublishRequest {
            post_id: "post".into(),
            account_id: "account".into(),
            title: Some("Title".into()),
            caption: Some("Business caption".into()),
            description: None,
            keywords: vec![],
            media_paths: vec![],
            platform_metadata: json!({}),
        };
        let body = adapter.post_body(&request, None);
        assert_eq!(body["author"], "urn:li:organization:123");
        assert_eq!(body["commentary"], "Business caption");
    }
}
