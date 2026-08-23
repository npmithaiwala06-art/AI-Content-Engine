use crate::error::AppError;
use chrono::{DateTime, Duration, Utc};
use keyring::v1::Entry;
use serde::{Deserialize, Serialize};

const KEYCHAIN_SERVICE: &str = "com.socialflow.localos.oauth";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityStatus {
    pub keychain_available: bool,
    pub provider: String,
    pub detail: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCredentialBundle {
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_endpoint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RefreshResponse {
    access_token: String,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
}

fn entry(storage_key: &str) -> Result<Entry, AppError> {
    if storage_key.trim().is_empty() {
        return Err(AppError::Validation(
            "OAuth storage key cannot be empty".into(),
        ));
    }
    Entry::new(KEYCHAIN_SERVICE, storage_key)
        .map_err(|error| AppError::Validation(format!("macOS Keychain is unavailable: {error}")))
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    })
}

fn decode_credential(value: &str) -> Result<OAuthCredentialBundle, AppError> {
    match serde_json::from_str::<OAuthCredentialBundle>(value) {
        Ok(bundle) if !bundle.access_token.trim().is_empty() => Ok(bundle),
        Ok(_) => Err(AppError::Validation(
            "Stored OAuth credential has no access token".into(),
        )),
        Err(_) if !value.trim().is_empty() => Ok(OAuthCredentialBundle {
            access_token: value.into(),
            ..OAuthCredentialBundle::default()
        }),
        Err(_) => Err(AppError::Validation(
            "Stored OAuth credential is empty".into(),
        )),
    }
}

fn needs_refresh(bundle: &OAuthCredentialBundle) -> bool {
    let Some(expires_at) = bundle.expires_at.as_deref() else {
        return false;
    };
    DateTime::parse_from_rfc3339(expires_at)
        .map(|value| value.with_timezone(&Utc) <= Utc::now() + Duration::minutes(5))
        .unwrap_or(false)
}

fn validated_token_endpoint(endpoint: &str) -> Result<reqwest::Url, AppError> {
    let url = reqwest::Url::parse(endpoint)
        .map_err(|_| AppError::Validation("OAuth token endpoint is invalid".into()))?;
    let host = url.host_str().unwrap_or_default();
    let allowed = [
        "oauth2.googleapis.com",
        "api.x.com",
        "graph.facebook.com",
        "www.linkedin.com",
    ];
    if url.scheme() != "https" || !allowed.contains(&host) {
        return Err(AppError::Validation(
            "OAuth token endpoint is not an approved official provider endpoint".into(),
        ));
    }
    Ok(url)
}

fn refresh_credential(
    storage_key: &str,
    mut bundle: OAuthCredentialBundle,
) -> Result<OAuthCredentialBundle, AppError> {
    let refresh_token = bundle.refresh_token.clone().ok_or_else(|| {
        AppError::Validation(
            "This social authorization has expired and did not include a refresh token. Reconnect the account from Social Accounts.".into(),
        )
    })?;
    let endpoint = bundle.token_endpoint.clone().ok_or_else(|| {
        AppError::Validation(
            "This authorization cannot refresh because its OAuth token endpoint is missing. Reconnect the account.".into(),
        )
    })?;
    let endpoint = validated_token_endpoint(&endpoint)?;
    let client_id = bundle.client_id.clone().ok_or_else(|| {
        AppError::Validation(
            "This authorization cannot refresh because its OAuth client ID is missing. Reconnect the account.".into(),
        )
    })?;
    let mut form = vec![
        ("grant_type", "refresh_token".to_owned()),
        ("refresh_token", refresh_token),
        ("client_id", client_id),
    ];
    if let Some(secret) = bundle.client_secret.as_ref() {
        form.push(("client_secret", secret.clone()));
    }
    let response = reqwest::blocking::Client::new()
        .post(endpoint)
        .form(&form)
        .send()
        .map_err(|error| {
            AppError::Validation(format!("Could not refresh social authorization: {error}"))
        })?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(AppError::Validation(format!(
            "Social authorization refresh failed ({status}). Reauthorize this account from Social Accounts."
        )));
    }
    let refreshed: RefreshResponse = response.json().map_err(|error| {
        AppError::Validation(format!("OAuth refresh returned invalid JSON: {error}"))
    })?;
    if refreshed.access_token.trim().is_empty() {
        return Err(AppError::Validation(
            "OAuth refresh returned an empty access token".into(),
        ));
    }
    bundle.access_token = refreshed.access_token;
    if let Some(token) = optional_trimmed(refreshed.refresh_token) {
        bundle.refresh_token = Some(token);
    }
    if let Some(seconds) = refreshed.expires_in {
        bundle.expires_at = Some((Utc::now() + Duration::seconds(seconds)).to_rfc3339());
    }
    store_oauth_credentials(storage_key, &bundle)?;
    Ok(bundle)
}

pub fn status() -> SecurityStatus {
    match Entry::store_status() {
        Ok(()) => SecurityStatus {
            keychain_available: true,
            provider: "macOS Keychain Services".into(),
            detail: "OAuth access tokens, refresh tokens and client secrets are stored outside SQLite and source code.".into(),
        },
        Err(error) => SecurityStatus {
            keychain_available: false,
            provider: "Unavailable".into(),
            detail: error.to_string(),
        },
    }
}

pub fn store_oauth_credentials(
    storage_key: &str,
    bundle: &OAuthCredentialBundle,
) -> Result<(), AppError> {
    if bundle.access_token.trim().is_empty() {
        return Err(AppError::Validation("OAuth token cannot be empty".into()));
    }
    let encoded = serde_json::to_string(bundle)?;
    entry(storage_key)?.set_password(&encoded).map_err(|error| {
        AppError::Validation(format!(
            "Could not save OAuth credentials in Keychain: {error}"
        ))
    })
}

#[allow(dead_code)]
pub fn store_oauth_token(storage_key: &str, token: &str) -> Result<(), AppError> {
    store_oauth_credentials(
        storage_key,
        &OAuthCredentialBundle {
            access_token: token.into(),
            ..OAuthCredentialBundle::default()
        },
    )
}

pub fn read_oauth_token(storage_key: &str) -> Result<String, AppError> {
    let stored = entry(storage_key)?.get_password().map_err(|error| {
        AppError::Validation(format!(
            "Could not read OAuth credentials from Keychain: {error}"
        ))
    })?;
    let bundle = decode_credential(&stored)?;
    if needs_refresh(&bundle) {
        return Ok(refresh_credential(storage_key, bundle)?.access_token);
    }
    Ok(bundle.access_token)
}

pub fn delete_oauth_token(storage_key: &str) -> Result<(), AppError> {
    entry(storage_key)?.delete_credential().map_err(|error| {
        AppError::Validation(format!(
            "Could not remove OAuth credentials from Keychain: {error}"
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_keys_and_tokens_before_touching_keychain() {
        assert!(store_oauth_token("", "token").is_err());
        assert!(store_oauth_token("account", "").is_err());
    }

    #[test]
    fn reads_legacy_plain_tokens_and_structured_credentials() {
        assert_eq!(
            decode_credential("legacy-token").unwrap().access_token,
            "legacy-token"
        );
        let encoded = serde_json::json!({
            "accessToken": "secure-token",
            "refreshToken": "refresh-token",
            "clientId": "client"
        })
        .to_string();
        let decoded = decode_credential(&encoded).unwrap();
        assert_eq!(decoded.access_token, "secure-token");
        assert_eq!(decoded.refresh_token.as_deref(), Some("refresh-token"));
    }

    #[test]
    fn recognises_credentials_near_expiry() {
        let bundle = OAuthCredentialBundle {
            access_token: "token".into(),
            expires_at: Some((Utc::now() + Duration::minutes(2)).to_rfc3339()),
            ..OAuthCredentialBundle::default()
        };
        assert!(needs_refresh(&bundle));
    }

    #[test]
    fn allows_only_official_oauth_token_hosts() {
        assert!(validated_token_endpoint("https://oauth2.googleapis.com/token").is_ok());
        assert!(validated_token_endpoint("https://api.x.com/2/oauth2/token").is_ok());
        assert!(validated_token_endpoint("https://attacker.example/token").is_err());
        assert!(
            validated_token_endpoint("https://oauth2.googleapis.com.attacker.example/token")
                .is_err()
        );
        assert!(validated_token_endpoint("http://oauth2.googleapis.com/token").is_err());
    }
}
