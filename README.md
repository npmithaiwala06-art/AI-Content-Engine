# SocialFlow OS

SocialFlow OS is a professional local-first social-media automation application for macOS.

> **Product law:** One Mac → Multiple Clients → Multiple Social Platforms → ChatGPT Creates → Human Approves → Scheduled Automatically → Published → Analytics → ChatGPT Improves Future Content.

The application does not require an AI API key. For a personal desktop installation, it can connect a ChatGPT account through the official Codex client, generate structured content directly inside SocialFlow, and import the result as local drafts. Manual copy/import and local Ollama remain available as fallbacks. The human approval boundary remains mandatory by default.

## Implementation status

The complete local product workflow is implemented through the Phase 40 audit:

- Tauri 2 desktop application with React, TypeScript, Rust and SQLite
- multi-client CRUD, archived clients, logos and persistent Brand Profiles
- connected Codex AI Workspace with Brand Memory, analytics learning, structured generation and copy/export
- isolated ChatGPT subscription sign-in through the official Codex browser flow; SocialFlow never receives the password or reads raw session credentials
- optional local Ollama provider detection and generation with installed on-device models; manual ChatGPT remains available
- validated `social_content_v1` importer with preview and duplicate prevention
- platform-specific Content Studio for Instagram, Facebook, LinkedIn and YouTube
- local Media Library with upload, preview, search, tags and per-platform post attachments
- mandatory approval history, rejection reasons and scheduling guard
- real attached-media previews and explicit CTA review inside the approval queue
- month, week and day calendar with persistent rescheduling
- durable local scheduler, publishing queue, retry, cancellation, restart recovery and an optional macOS LaunchAgent for closed-app checks
- modular platform-adapter boundary and fully working Mock Publishing Mode
- local notifications and macOS notification delivery when enabled
- mock analytics, KPI dashboard, charts and platform/content comparison
- ChatGPT analytics prompt, structured recommendations import and future-prompt learning loop
- weekly, monthly, campaign, platform and client reports with branded local PDF/CSV export and PDF platform charts
- campaigns, bulk content plans, universal search and activity audit
- local database/media/full backup, validated restart-safe restore and first-run onboarding
- macOS Keychain-backed official account connection, validation and token removal
- official adapter dispatch for Facebook Page text/image/video, LinkedIn text/image, YouTube video/thumbnail and Instagram public-URL media publishing
- separate connected-platform analytics collection and local normalization
- production `.app` build configuration and ad-hoc signing for this Mac
- single-instance protection that restores and focuses the existing window on repeated launches

Official adapter code is included in version 0.3.0, but a real account becomes active only after its owner creates the required developer application and authorizes a test or production account. Mock Mode tests the entire controlled workflow without credentials. Authorized platform tokens are validated and stored through macOS Keychain; no social password belongs in the app or SQLite. The **Release Readiness** page continuously checks Phases 12, 35, 37 and 40 without pretending external approvals succeeded. See [official platform setup](docs/OFFICIAL_PLATFORM_SETUP.md) for the supported formats and platform limitations.

## Technology

| Layer | Choice | Purpose |
|---|---|---|
| Desktop | Tauri 2 | Native macOS bundle and secure Rust command boundary |
| Frontend | React 18 + TypeScript + Vite | Typed commercial desktop UI |
| Native core | Rust | SQLite, files, scheduler, adapters, exports and backups |
| Database | SQLite with `rusqlite` | One local source of truth; no server |
| Media | macOS application-data folder | Local ownership and backup boundary |
| AI | Official local Codex client, manual ChatGPT fallback and optional Ollama | ChatGPT subscription mode needs no API key |

A separate FastAPI process is not used because the Tauri native core already provides the required local database, scheduler and file operations with less operational complexity.

## Exact macOS commands

Installed desktop builds automatically check GitHub Releases for signed updates after launch and
every six hours. Updates install quietly and take effect on the next launch. See
[automatic desktop updates](docs/AUTO_UPDATES.md) for signing and publishing instructions.

Open Terminal and run:

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm install
npm run desktop:dev
```

The development command opens the native application. On first launch, the onboarding flow appears and the database is created at:

```text
/Users/neevmithaiwala/Library/Application Support/com.socialflow.localos/socialflow.sqlite
```

For a fast browser-only UI preview:

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm run dev
```

Open `http://127.0.0.1:1420`. Browser preview data uses `localStorage`; it is deliberately separate from the desktop SQLite database.

## Build the standalone Mac app

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm run desktop:build
```

Expected result:

```text
/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing/src-tauri/target/release/bundle/macos/SocialFlow OS.app
```

The current verified 0.3.0 copy is also available at:

```text
/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing/releases/SocialFlow OS 0.3.0 Review.app
```

Open it in Finder or run:

```bash
open "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing/src-tauri/target/release/bundle/macos/SocialFlow OS.app"
```

The local build is ad-hoc signed. Sharing it with other Macs still requires an Apple Developer ID, notarization and a distributable package.

## Run every automated check

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm run build
npm test -- --run
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

You should see 30 frontend tests and 30 native tests pass, followed by a clean strict Clippy result.

## End-to-end test

1. Create a client and complete its Brand Profile.
2. Open **ChatGPT**, choose **Connect ChatGPT**, and complete the official OpenAI browser sign-in once.
3. Open **AI Workspace** and choose **Generate Content**. Review the returned JSON and import selected posts as drafts without copy/paste.
4. Open **Create Content**, edit each platform independently and attach local media.
5. Send the post for approval. Approve it in **Approvals**.
6. Schedule it from **Calendar** using a near-future time.
7. Confirm a Mock account in **Social Accounts** and watch **Publishing Queue**.
8. The scheduler publishes once, stores a fake external ID and records activity/notifications.
9. Open **Analytics**, collect Mock Analytics and copy the ChatGPT analysis prompt.
10. Import the structured recommendations. The next AI Workspace prompt includes recent learning.
11. Generate a report, export PDF/CSV, then create a full local backup in **Settings**.

## Common problems

- **Rust or `cargo` not found:** install the Rust toolchain from `https://rustup.rs`, reopen Terminal, and run `cargo --version`.
- **`xcrun` or linker error:** run `xcode-select --install`, finish Apple’s installer and retry.
- **Port 1420 already in use:** stop the older Vite process with `Control-C` and rerun the command.
- **The app appears stale or does not focus:** use version 0.3.0. It prevents multiple SocialFlow schedulers and focuses the existing window on a repeated launch.
- **Scheduled posts do not run while the app is closed:** open **Settings → Scheduler** and enable **Run when app is closed**. Toggle it off and on again after moving the app to a new folder.
- **Browser data missing in the desktop app:** expected; browser preview and desktop SQLite are separate safety boundaries.
- **A post will not schedule:** it must have a recorded human approval and at least one platform version.
- **Publishing fails in Mock Mode:** open **Social Accounts** and disable the intentional “fail next publish” test control, or use Retry.
- **Media will not delete:** detach it from all post versions first.
- **Restore says restart required:** quit and reopen SocialFlow OS; the restore is applied before the database opens, and the current database is preserved as a safety copy.
- **Official Connect rejects a token:** confirm the developer app permissions, account ID/URN/channel ID, token expiry and platform review status. This is unrelated to AI keys.
- **ChatGPT connection is unavailable:** install the ChatGPT desktop app or official Codex CLI, then reopen SocialFlow and connect again.
- **Codex limit reached:** generation follows the connected ChatGPT account's Codex allowance; wait for its reset or use an available credit option.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md), and [docs/FINAL_PRODUCT_AUDIT.md](docs/FINAL_PRODUCT_AUDIT.md) for the implementation and audit details.

The isolated ChatGPT subscription design is documented in [docs/CHATGPT_WEBVIEW.md](docs/CHATGPT_WEBVIEW.md).
