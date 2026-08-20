# ChatGPT subscription connection

SocialFlow OS exposes a **ChatGPT** tab that connects a personal ChatGPT account through the official local Codex client. ChatGPT itself is not embedded in the application. After the one-time browser sign-in, SocialFlow can generate captions, scripts, ideas and structured content plans inside its own interface without requesting an OpenAI API key.

## Authentication flow

1. SocialFlow locates the Codex executable bundled with the ChatGPT desktop app or installed as the official Codex CLI.
2. **Connect ChatGPT** starts `codex login` with a SocialFlow-specific `CODEX_HOME`.
3. Codex opens OpenAI's official browser authentication flow.
4. The official client stores and refreshes its session inside SocialFlow's private application-data directory.
5. SocialFlow checks only `codex login status`; it does not read `auth.json`, copy access tokens or receive the user's password.

The isolated session directory is created with owner-only permissions on Unix platforms. Disconnecting runs the official Codex logout command against only this SocialFlow-specific session, so it does not deliberately remove another Codex client's default profile.

## Generation flow

SocialFlow sends an explicit, locally constructed content brief to `codex exec` over standard input. The prompt is not placed in shell source or interpolated into a shell command. Each run:

- is ephemeral;
- uses an empty application-cache workspace;
- loads no project rules;
- selects the read-only Codex sandbox;
- has a bounded prompt size and a 12-minute timeout;
- receives only the final response through a temporary output file, which is deleted after reading.

Generated `social_content_v1` JSON is staged in session storage only long enough to open the review importer. It is not scheduled or published automatically. The importer validates it, saves selected items as Drafts, and preserves mandatory human approval.

## Product boundary

This mode is designed for the person who owns both the local SocialFlow installation and the connected ChatGPT account. Usage follows that account's Codex entitlement, limits, workspace controls and data settings.

It is not an OpenAI API key, a public OpenAI-compatible gateway, or a way to share one subscription across unrelated users. A hosted, multi-user or customer-facing SocialFlow service must use an officially supported application integration and its corresponding billing model.

## Browser preview

The Vite browser preview cannot run local native commands. It shows the disconnected state and keeps the manual prompt/import workflow available. Subscription connection and direct generation require the packaged Tauri desktop application.

Official OpenAI documentation: [Codex authentication](https://learn.chatgpt.com/docs/auth) and [Codex App Server](https://learn.chatgpt.com/docs/app-server).
