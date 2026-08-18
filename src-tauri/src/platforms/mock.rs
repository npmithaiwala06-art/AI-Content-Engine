use uuid::Uuid;

use super::{PlatformAdapter, PlatformKind, PublishRequest, PublishResult};

pub struct MockPlatformAdapter {
    platform: PlatformKind,
}

impl MockPlatformAdapter {
    pub fn new(platform: PlatformKind) -> Self {
        Self { platform }
    }
}

impl PlatformAdapter for MockPlatformAdapter {
    fn platform(&self) -> PlatformKind {
        self.platform.clone()
    }

    fn connect(&self) -> Result<(), String> {
        Ok(())
    }

    fn disconnect(&self) -> Result<(), String> {
        Ok(())
    }

    fn validate_connection(&self) -> Result<bool, String> {
        Ok(true)
    }

    fn publish_post(&self, request: &PublishRequest) -> Result<PublishResult, String> {
        Ok(PublishResult {
            succeeded: true,
            external_post_id: Some(format!("mock-{}", Uuid::new_v4())),
            message: format!("Simulated publish for post {}", request.post_id),
        })
    }

    fn get_publish_status(&self, _external_post_id: &str) -> Result<String, String> {
        Ok("published".to_owned())
    }

    fn fetch_analytics(&self, _external_post_id: &str) -> Result<serde_json::Value, String> {
        Ok(serde_json::json!({ "mode": "mock", "metrics": {} }))
    }
}
