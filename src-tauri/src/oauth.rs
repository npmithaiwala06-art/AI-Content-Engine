use crate::{
    database::Database,
    error::AppError,
    social_accounts::{self, OfficialConnectionInput},
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Duration, Utc};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
    time::{Duration as StdDuration, Instant},
};
use url::Url;
use uuid::Uuid;

const CALLBACK_TIMEOUT: StdDuration = StdDuration::from_secs(300);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthConfiguration {
    pub platform: String,
    pub available: bool,
    pub connection_method: String,
    pub detail: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserOAuthInput {
    pub client_id: String,
    pub platform: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserOAuthResult {
    pub account_id: String,
    pub platform: String,
    pub account_name: String,
    pub external_account_id: String,
}

#[derive(Debug, Clone)]
struct ProviderSpec {
    platform: String,
    client_id: String,
    authorization_endpoint: &'static str,
    token_endpoint: &'static str,
    scopes: &'static [&'static str],
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
}

#[derive(Debug)]
struct AuthorizedIdentity {
    external_id: String,
    name: String,
    username: Option<String>,
}

fn embedded_client_id(platform: &str) -> Option<&'static str> {
    match platform {
        "youtube" => option_env!("SOCIALFLOW_YOUTUBE_CLIENT_ID"),
        "twitter" => option_env!("SOCIALFLOW_X_CLIENT_ID"),
        _ => None,
    }
    .map(str::trim)
    .filter(|value| !value.is_empty())
}

fn configuration(platform: &str, client_id: Option<&str>) -> OAuthConfiguration {
    match platform {
        "instagram" | "facebook" => OAuthConfiguration {
            platform: platform.into(),
            available: false,
            connection_method: "broker".into(),
            detail: "The secure Meta connection service must be configured by the app owner before Instagram or Facebook can be connected. SocialFlow will never store a Meta App Secret in this desktop app.".into(),
        },
        "youtube" | "twitter" if client_id.is_some_and(|value| !value.trim().is_empty()) => {
            OAuthConfiguration {
                platform: platform.into(),
                available: true,
                connection_method: "browser_pkce".into(),
                detail: "Ready for secure official sign-in. No access token or client secret is entered into SocialFlow.".into(),
            }
        }
        "youtube" | "twitter" => OAuthConfiguration {
            platform: platform.into(),
            available: false,
            connection_method: "browser_pkce".into(),
            detail: "The app owner must configure this platform's public OAuth client ID in the signed SocialFlow build. Users never need to paste an access token.".into(),
        },
        _ => OAuthConfiguration {
            platform: platform.into(),
            available: false,
            connection_method: "unsupported".into(),
            detail: "This platform is not supported by the secure connection flow.".into(),
        },
    }
}

pub fn list_configurations() -> Vec<OAuthConfiguration> {
    ["instagram", "facebook", "twitter", "youtube"]
        .into_iter()
        .map(|platform| configuration(platform, embedded_client_id(platform)))
        .collect()
}

fn provider_spec(platform: &str, client_id: &str) -> Result<ProviderSpec, String> {
    if client_id.trim().is_empty() {
        return Err("The app owner has not configured this platform's OAuth client ID".into());
    }
    let (authorization_endpoint, token_endpoint, scopes) = match platform {
        "youtube" => (
            "https://accounts.google.com/o/oauth2/v2/auth",
            "https://oauth2.googleapis.com/token",
            &[
                "https://www.googleapis.com/auth/youtube.upload",
                "https://www.googleapis.com/auth/youtube.readonly",
                "https://www.googleapis.com/auth/yt-analytics.readonly",
            ][..],
        ),
        "twitter" => (
            "https://x.com/i/oauth2/authorize",
            "https://api.x.com/2/oauth2/token",
            &[
                "tweet.read",
                "tweet.write",
                "users.read",
                "media.write",
                "offline.access",
            ][..],
        ),
        "instagram" | "facebook" => {
            return Err("Instagram and Facebook require the secure Meta connection service; a confidential Meta App Secret must never be embedded in SocialFlow OS.".into());
        }
        _ => {
            return Err(format!(
                "Secure browser connection is not implemented for {platform}"
            ))
        }
    };
    Ok(ProviderSpec {
        platform: platform.into(),
        client_id: client_id.trim().into(),
        authorization_endpoint,
        token_endpoint,
        scopes,
    })
}

fn authorization_url(
    spec: &ProviderSpec,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> Result<String, String> {
    let mut url = Url::parse(spec.authorization_endpoint).map_err(|error| error.to_string())?;
    let mut query = url.query_pairs_mut();
    query
        .append_pair("client_id", &spec.client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("state", state)
        .append_pair("scope", &spec.scopes.join(" "))
        .append_pair("code_challenge", code_challenge)
        .append_pair("code_challenge_method", "S256");
    if spec.platform == "youtube" {
        query
            .append_pair("access_type", "offline")
            .append_pair("prompt", "consent")
            .append_pair("include_granted_scopes", "true");
    }
    drop(query);
    Ok(url.into())
}

fn random_urlsafe() -> String {
    URL_SAFE_NO_PAD.encode(Uuid::new_v4().as_bytes())
}

fn pkce_verifier() -> String {
    format!(
        "{}{}{}",
        random_urlsafe(),
        random_urlsafe(),
        random_urlsafe()
    )
}

fn pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn parse_callback_target(target: &str, expected_state: &str) -> Result<String, String> {
    let url = Url::parse(&format!("http://127.0.0.1{target}"))
        .map_err(|_| "The OAuth callback URL was invalid".to_string())?;
    let params = url.query_pairs().collect::<HashMap<_, _>>();
    let state = params
        .get("state")
        .ok_or_else(|| "The OAuth callback did not include state".to_string())?;
    if state.as_ref() != expected_state {
        return Err("OAuth state mismatch; authorization was cancelled for safety".into());
    }
    if let Some(error) = params.get("error") {
        let detail = params
            .get("error_description")
            .map(|value| value.as_ref())
            .unwrap_or(error.as_ref());
        return Err(format!("Platform authorization failed: {detail}"));
    }
    params
        .get("code")
        .map(|value| value.to_string())
        .ok_or_else(|| "The OAuth callback did not include an authorization code".into())
}

fn browser_response(stream: &mut TcpStream, succeeded: bool, detail: &str) {
    let title = if succeeded {
        "SocialFlow OS connected"
    } else {
        "SocialFlow OS authorization failed"
    };
    let safe_detail = detail
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;");
    let body = format!(
        "<!doctype html><meta charset=\"utf-8\"><title>{title}</title><style>body{{font-family:-apple-system,sans-serif;max-width:680px;margin:12vh auto;padding:32px;color:#172033}}h1{{font-size:26px}}p{{line-height:1.6}}</style><h1>{title}</h1><p>{safe_detail}</p><p>You can close this tab and return to <strong>SocialFlow OS</strong>.</p>"
    );
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\n\r\n{}",
        body.len(), body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn wait_for_callback(listener: TcpListener, expected_state: &str) -> Result<String, AppError> {
    listener.set_nonblocking(true)?;
    let started = Instant::now();
    loop {
        match listener.accept() {
            Ok((mut stream, peer)) => {
                if !peer.ip().is_loopback() {
                    continue;
                }
                stream.set_read_timeout(Some(StdDuration::from_secs(5)))?;
                let mut buffer = [0_u8; 16_384];
                let count = stream.read(&mut buffer)?;
                let request = String::from_utf8_lossy(&buffer[..count]);
                let first_line = request.lines().next().ok_or_else(|| {
                    AppError::Validation("OAuth callback request was invalid".into())
                })?;
                let mut parts = first_line.split_whitespace();
                if parts.next() != Some("GET") {
                    browser_response(&mut stream, false, "Only GET callbacks are accepted.");
                    continue;
                }
                let target = parts.next().ok_or_else(|| {
                    AppError::Validation("OAuth callback request was invalid".into())
                })?;
                if !target.starts_with("/oauth/callback?") {
                    browser_response(&mut stream, false, "The callback path was invalid.");
                    continue;
                }
                let result = parse_callback_target(target, expected_state);
                match &result {
                    Ok(_) => browser_response(
                        &mut stream,
                        true,
                        "Authorization was received through the secure local callback.",
                    ),
                    Err(error) => browser_response(&mut stream, false, error),
                }
                return result.map_err(AppError::Validation);
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if started.elapsed() >= CALLBACK_TIMEOUT {
                    return Err(AppError::Validation(
                        "Authorization timed out after five minutes. Try Connect again.".into(),
                    ));
                }
                thread::sleep(StdDuration::from_millis(100));
            }
            Err(error) => return Err(error.into()),
        }
    }
}

fn safe_provider_error(response: reqwest::blocking::Response, action: &str) -> AppError {
    let status = response.status();
    let body = response.text().unwrap_or_default();
    let detail = serde_json::from_str::<Value>(&body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/message")
                .or_else(|| value.get("error_description"))
                .or_else(|| value.get("detail"))
                .or_else(|| value.get("title"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .filter(|value| value.len() <= 500)
        .unwrap_or_else(|| "The provider rejected the request without a safe error message".into());
    AppError::Validation(format!("{action} failed ({status}): {detail}"))
}

fn exchange_code(
    http: &Client,
    spec: &ProviderSpec,
    code: &str,
    redirect_uri: &str,
    verifier: &str,
) -> Result<TokenResponse, AppError> {
    let response = http
        .post(spec.token_endpoint)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("client_id", spec.client_id.as_str()),
            ("code_verifier", verifier),
        ])
        .send()
        .map_err(|error| {
            AppError::Validation(format!(
                "Could not exchange the authorization code: {error}"
            ))
        })?;
    if !response.status().is_success() {
        return Err(safe_provider_error(response, "OAuth token exchange"));
    }
    response.json().map_err(|error| {
        AppError::Validation(format!("The OAuth token response was invalid: {error}"))
    })
}

fn discover_identity(
    http: &Client,
    platform: &str,
    access_token: &str,
) -> Result<AuthorizedIdentity, AppError> {
    let response = match platform {
        "youtube" => http
            .get("https://www.googleapis.com/youtube/v3/channels")
            .query(&[("part", "id,snippet"), ("mine", "true")])
            .bearer_auth(access_token)
            .send(),
        "twitter" => http
            .get("https://api.x.com/2/users/me")
            .query(&[("user.fields", "name,username")])
            .bearer_auth(access_token)
            .send(),
        _ => return Err(AppError::Validation("Unsupported OAuth platform".into())),
    }
    .map_err(|error| {
        AppError::Validation(format!("Could not load the authorized account: {error}"))
    })?;
    if !response.status().is_success() {
        return Err(safe_provider_error(
            response,
            "Authorized account discovery",
        ));
    }
    let body: Value = response.json().map_err(|error| {
        AppError::Validation(format!(
            "The authorized account response was invalid: {error}"
        ))
    })?;
    match platform {
        "youtube" => {
            let channel = body.pointer("/items/0").ok_or_else(|| {
                AppError::Validation(
                    "No YouTube channel was available for this Google account".into(),
                )
            })?;
            let external_id = channel
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if external_id.is_empty() {
                return Err(AppError::Validation(
                    "YouTube did not return a channel ID".into(),
                ));
            }
            Ok(AuthorizedIdentity {
                external_id: external_id.into(),
                name: channel
                    .pointer("/snippet/title")
                    .and_then(Value::as_str)
                    .unwrap_or("YouTube channel")
                    .into(),
                username: channel
                    .pointer("/snippet/customUrl")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
            })
        }
        "twitter" => {
            let data = body.get("data").unwrap_or(&Value::Null);
            let external_id = data.get("id").and_then(Value::as_str).unwrap_or_default();
            if external_id.is_empty() {
                return Err(AppError::Validation("X did not return a user ID".into()));
            }
            let username = data
                .get("username")
                .and_then(Value::as_str)
                .map(str::to_owned);
            Ok(AuthorizedIdentity {
                external_id: external_id.into(),
                name: data
                    .get("name")
                    .and_then(Value::as_str)
                    .or(username.as_deref())
                    .unwrap_or("X account")
                    .into(),
                username,
            })
        }
        _ => unreachable!(),
    }
}

pub fn connect_with_browser<F>(
    database: &Database,
    input: BrowserOAuthInput,
    open_browser: F,
) -> Result<BrowserOAuthResult, AppError>
where
    F: FnOnce(&str) -> Result<(), AppError>,
{
    let platform = input.platform.trim();
    let configured = embedded_client_id(platform)
        .ok_or_else(|| AppError::Validation(configuration(platform, None).detail))?;
    let spec = provider_spec(platform, configured).map_err(AppError::Validation)?;
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|error| {
        AppError::Validation(format!(
            "Could not start the secure local OAuth callback: {error}"
        ))
    })?;
    let port = listener.local_addr()?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth/callback");
    let state = random_urlsafe();
    let verifier = pkce_verifier();
    let auth_url = authorization_url(&spec, &redirect_uri, &state, &pkce_challenge(&verifier))
        .map_err(AppError::Validation)?;
    open_browser(&auth_url)?;
    let code = wait_for_callback(listener, &state)?;

    let http = Client::builder()
        .timeout(StdDuration::from_secs(120))
        .build()
        .map_err(|error| {
            AppError::Validation(format!(
                "Could not initialize secure OAuth networking: {error}"
            ))
        })?;
    let token = exchange_code(&http, &spec, &code, &redirect_uri, &verifier)?;
    if token.access_token.trim().is_empty() {
        return Err(AppError::Validation(
            "The platform returned an empty access token".into(),
        ));
    }
    let identity = discover_identity(&http, &spec.platform, &token.access_token)?;
    let expiry = token
        .expires_in
        .map(|seconds| (Utc::now() + Duration::seconds(seconds)).to_rfc3339());
    let display_name = identity
        .username
        .as_deref()
        .map(|username| format!("{} (@{username})", identity.name))
        .unwrap_or_else(|| identity.name.clone());
    let account_id = social_accounts::connect_official_account(
        database,
        OfficialConnectionInput {
            client_id: input.client_id,
            platform: spec.platform.clone(),
            account_name: display_name.clone(),
            external_account_id: identity.external_id.clone(),
            access_token: token.access_token,
            token_expires_at: expiry,
            refresh_token: token.refresh_token,
            oauth_client_id: Some(spec.client_id),
            oauth_client_secret: None,
            token_endpoint: Some(spec.token_endpoint.into()),
            settings: json!({}),
        },
    )?;
    Ok(BrowserOAuthResult {
        account_id,
        platform: spec.platform,
        account_name: display_name,
        external_account_id: identity.external_id,
    })
}

#[cfg(test)]
fn provider_spec_for_test(platform: &str, client_id: &str) -> Result<ProviderSpec, String> {
    provider_spec(platform, client_id)
}

#[cfg(test)]
fn configuration_for_test(platform: &str, client_id: Option<&str>) -> OAuthConfiguration {
    configuration(platform, client_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn youtube_authorization_uses_loopback_pkce_and_offline_access() {
        let spec = provider_spec_for_test("youtube", "google-client").unwrap();
        let url = authorization_url(
            &spec,
            "http://127.0.0.1:53682/oauth/callback",
            "state-value",
            "challenge-value",
        )
        .unwrap();

        assert!(url.starts_with("https://accounts.google.com/o/oauth2/v2/auth?"));
        assert!(url.contains("access_type=offline"));
        assert!(url.contains("prompt=consent"));
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("youtube.upload"));
    }

    #[test]
    fn x_authorization_requests_publish_media_and_refresh_permissions() {
        let spec = provider_spec_for_test("twitter", "x-client").unwrap();
        let url = authorization_url(
            &spec,
            "http://127.0.0.1:53682/oauth/callback",
            "state-value",
            "challenge-value",
        )
        .unwrap();

        assert!(url.starts_with("https://x.com/i/oauth2/authorize?"));
        for scope in ["tweet.write", "users.read", "media.write", "offline.access"] {
            assert!(url.contains(scope), "missing scope {scope}");
        }
    }

    #[test]
    fn callback_parser_rejects_state_mismatch() {
        let error =
            parse_callback_target("/oauth/callback?code=abc&state=wrong", "expected").unwrap_err();
        assert!(error.contains("state mismatch"));
    }

    #[test]
    fn callback_parser_returns_authorization_code() {
        let code =
            parse_callback_target("/oauth/callback?code=abc%20123&state=expected", "expected")
                .unwrap();
        assert_eq!(code, "abc 123");
    }

    #[test]
    fn meta_platforms_require_the_secure_broker() {
        for platform in ["instagram", "facebook"] {
            let status = configuration_for_test(platform, None);
            assert!(!status.available);
            assert!(status.detail.contains("secure Meta connection service"));
        }
    }

    #[test]
    fn public_desktop_oauth_requires_an_owner_configured_client_id() {
        let status = configuration_for_test("youtube", None);
        assert!(!status.available);
        assert!(status.detail.contains("app owner"));
    }
}
