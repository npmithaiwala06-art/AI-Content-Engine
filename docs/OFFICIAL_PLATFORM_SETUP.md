# Official social-platform access — version 0.3.2

Official social authorization is separate from AI. SocialFlow OS still uses no AI API key.

## Secure connection workflow

1. Create and authorize an application in the platform's official developer portal.
2. Request only the publishing and analytics permissions needed for the account.
3. Generate an authorized test or production access token.
4. Open **Social Accounts**, select the client and choose **Set up official access**.
5. Enter the platform account ID and access token.
6. SocialFlow validates the token against the platform before storing it in macOS Keychain.
7. SQLite stores only the opaque Keychain reference, account ID, expiry and non-secret settings.

When the platform also supplies a refresh token, open **Add refresh settings for unattended scheduling**. The refresh token, OAuth client ID and optional client secret are stored together in macOS Keychain. SocialFlow refreshes an expiring access token before scheduled publishing or analytics. Platforms that do not issue a refresh token require reauthorization when their access token expires.

Never enter a social-media password. Access tokens can be removed with **Disconnect**.

## Capability matrix

| Platform | Implemented publishing | Implemented analytics | Important requirement |
|---|---|---|---|
| Instagram | Image/Reel container creation and publish | Media insights normalization | Meta must fetch approved media from a public HTTPS URL; a Mac-local path is not reachable by Meta |
| Facebook | Page text, image and video posts from local files | Post insights normalization | Use a Page access token with Page publishing permissions |
| Twitter | Text, up to four images, one GIF or one video using chunked upload | Likes, replies, reposts, quotes and impressions | Connect the numeric X user ID returned by `GET /2/users/me`; video processing is checked before the post is created |
| YouTube | Resumable local video upload plus optional thumbnail | Video statistics | The default privacy is **Private**; a refreshable OAuth authorization is recommended for unattended scheduling |

Mock Mode remains available and is still the safest end-to-end test path.

## Official prerequisites

- Instagram content publishing: <https://developers.facebook.com/docs/instagram-platform/content-publishing>
- Facebook Pages posts: <https://developers.facebook.com/docs/pages-api/posts>
- X OAuth 2.0 authorization with PKCE: <https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code>
- X post creation: <https://docs.x.com/x-api/posts/manage-tweets/introduction>
- X media upload: <https://docs.x.com/x-api/media/upload-media>
- YouTube OAuth: <https://developers.google.com/youtube/v3/guides/authentication>
- YouTube video upload: <https://developers.google.com/youtube/v3/guides/uploading_a_video>

## Honest activation boundary

The adapters, secure authorized-token path and refresh-token storage are implemented and locally tested at their request-building, dispatch, validation, refresh, storage-boundary and normalization layers. Live platform calls cannot be certified until the product owner supplies an authorized developer application and test account. A branded browser consent flow still requires each platform's registered OAuth client ID, redirect URI and approval.

## Apple notarization

After obtaining an Apple Developer ID Application certificate and storing notary credentials:

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
export APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_NOTARY_PROFILE="socialflow-notary"
npm run desktop:notarize
```

The script signs with the hardened runtime, submits the app to Apple, waits for approval and staples the ticket. It deliberately stops if either owner credential is missing.
