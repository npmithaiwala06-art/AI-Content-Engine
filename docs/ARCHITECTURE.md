# System architecture

## Permanent workflow

```text
One Mac
  → multiple local client and brand workspaces
  → platform-specific content generated through a connected local Codex client
  → mandatory human review
  → approved local schedules
  → durable scheduler and publishing queue
  → isolated social-platform adapter
  → local publishing history and analytics
  → ChatGPT analytics prompt and recommendations import
  → improved future content prompt
```

AI content cannot jump directly into scheduling. Imported content starts as `draft`; the scheduler accepts only posts that have passed the approval service.

## Runtime boundary

```text
┌────────────────────────────── One Mac ──────────────────────────────┐
│ React + TypeScript                                                  │
│   navigation, forms, previews, charts, calendar, prompt workflows   │
│                         │ typed Tauri commands                       │
│ Rust native core         ▼                                           │
│   SQLite · filesystem · scheduler · reports · backup · notifications │
│                         │ normalized adapter contract                │
│   Mock / Instagram / Facebook / LinkedIn / YouTube adapters         │
└─────────────────────────┬────────────────────────────────────────────┘
                          │ Internet only for official OAuth/APIs
                          ▼
                   Social platforms

ChatGPT credentials remain outside the SocialFlow application runtime:
App prompt → official local Codex client → subscription model → structured result → reviewed draft import.
```

The native connector launches the official Codex browser sign-in and assigns it a private `CODEX_HOME` under SocialFlow's application-data directory. SocialFlow invokes the client but never reads the password or parses raw OAuth credentials. Generation uses an ephemeral Codex session, an empty application cache workspace and the read-only Codex sandbox. See [CHATGPT_WEBVIEW.md](CHATGPT_WEBVIEW.md).

## Major native modules

- `clients.rs`: clients, Brand Profiles, logos and lifecycle.
- `ai_workspace.rs`: local prompt history and structured content briefs.
- `chatgpt.rs`: official Codex discovery, isolated sign-in status and bounded generation.
- `content_importer.rs`: structured validation, ownership and duplicate prevention.
- `content_studio.rs`: editable core posts and independent platform versions.
- `media_library.rs`: local file validation, metadata and post attachments.
- `approvals.rs`: mandatory human decisions and rejection history.
- `calendar.rs`: approved-only persistent schedules.
- `automation.rs`: restart recovery, due-job claiming, durable publishing and notifications.
- `platforms/`: common adapter contract and isolated implementations.
- `analytics.rs`: normalized metrics, ChatGPT analysis prompt and recommendation learning.
- `reports.rs`: report snapshots and local PDF/CSV generation.
- `campaigns.rs`: campaigns and bulk content-plan records.
- `workspace.rs`: universal search, settings, activity, backup and restore.

## Scheduler and duplicate prevention

Every platform version gets one schedule and a stable idempotency key. `publishing_queue.schedule_id` is unique, so repeated scheduler ticks cannot enqueue a second job. The worker atomically moves `queued/retrying → publishing`, writes an attempt log before adapter work, and stores the external post ID on success. Jobs abandoned in `publishing` for five minutes are recovered to the retry path after a restart. Completed schedules never re-enter the due query.

The foreground desktop worker checks every 15 seconds while SocialFlow OS is running. A closed application cannot execute user-space code; macOS launch-at-login/background-agent packaging is future release engineering, not simulated behavior.

## Platform architecture

The shared adapter contract covers connection validation, publishing, status and analytics. Current local production testing uses `MockPlatformAdapter`, including deterministic success, intentional failure, retry and fake analytics. Instagram, Facebook, LinkedIn and YouTube each have isolated official adapter modules and honest connection requirements in the UI; real OAuth and publishing remain disabled until official developer applications and user authorization exist.

No social-media password is accepted. Future OAuth refresh/access tokens must be stored through macOS Keychain; SQLite stores only non-secret account metadata and a future secure-storage reference.

## AI boundary

The prompt builder combines:

- Client and Brand Profile memory
- Campaign and content requirements
- Platform-specific output rules
- Recent analytics
- Imported recommendations
- A versioned JSON response contract

When a private Codex session is connected, SocialFlow sends that brief only after an explicit Generate action and receives the final response through the official client. Otherwise, the manual provider and optional local Ollama workflow remain available. The importer validates the response contract and always creates drafts. `privacy.ai_api_enabled` remains rejected because this connection does not enable the OpenAI API.

## Local ownership and security

- SQLite foreign keys, WAL, busy timeout and migrations are enabled.
- Media uses generated filesystem names and validated types/sizes; display names never become paths.
- Tauri’s asset scope is limited to application data.
- Report and backup output stays local.
- Restore validates SQLite integrity, creates a safety copy and applies before database startup.
- Errors cross the Tauri boundary as sanitized application messages.
- No cloud database or remote SocialFlow AI gateway is present. Codex authentication is stored only in SocialFlow's private app-data session directory and is managed by the official client.
