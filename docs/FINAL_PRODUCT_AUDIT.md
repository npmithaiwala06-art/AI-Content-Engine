# Phase 40 — final product audit

Audit date: 17 August 2026

## Completed and verified locally

- Phases 1–8: foundation, clients, Brand Memory, AI Workspace, structured importer, Content Studio, Media Library, human approval and calendar.
- Phases 9–14: local scheduler, adapter architecture, Mock Publishing, social-account UI, durable queue, retry/cancel/publish-now and local notifications.
- Phases 15–21: analytics schema/dashboard, ChatGPT analysis prompt, recommendations importer, learning loop, five report types and PDF/CSV export.
- Phases 22–30: campaigns, bulk plans, platform previews, universal search, activity, settings, backup/restore, security defaults and optional controlled Autopilot.
- Phases 31–40: live dashboard, commercial UI states, functional/database/scheduler tests, build optimization, macOS bundle configuration, onboarding and end-to-end audit.

## Automated evidence

```text
Frontend production build: passed
Frontend tests: 22 passed
Rust native tests: 27 passed
Rust formatting: passed
Strict Clippy (-D warnings): passed
Database scale test: 2,500 posts, query and cascade checks passed
Interrupted publishing recovery: passed
Duplicate publishing prevention: passed
End-to-end mock create → approve → schedule → publish → analytics → recommendations: passed
PDF and CSV generation validation: passed
Backup integrity validation: passed
```

## Bugs found and fixed

- Dashboard incorrectly fell back to demo analytics when a native workspace had clients but no metrics; native empty states now remain honest.
- Today counters incorrectly fell back to all-time totals when today was zero; the actual zero is now shown.
- Published/publishing content could enter an unsafe editing path; terminal/in-flight records are immutable.
- Scheduler restart recovery needed an explicit abandoned-processing test; it now recovers once without duplicate success logs.
- Media existed locally but could not be attached from Content Studio; per-platform attachment/detachment is now implemented.
- Notifications originally covered only publish results; approval-required, scheduled, publishing-started, disconnected-account and report-ready events are now recorded.
- Notification insertion initially retained a database mutex after transaction commit; explicit guard release prevents a deadlock.
- Scale-test fixtures used an outdated column name; fixtures now match the migrated `core_idea` schema.
- Multiple development/production processes could remain open and make launch behavior appear stale; version 0.1.5 registers Tauri's single-instance plugin first and restores, shows and focuses the existing main window.
- Native macOS time inputs were difficult to edit and displayed a misleading resize handle; scheduling forms now use labelled hour, minute and AM/PM controls with useful time presets.
- A fully closed application could not inspect due work; the Scheduler setting can now install a local LaunchAgent that runs a one-shot, idempotent scheduler check every 30 seconds and after login/restart.
- The OAuth boundary previously had no secure persistence implementation; official tokens now have macOS Keychain store/read/delete commands and SQLite retains only the Keychain reference.
- PDF reports were visually basic; the local PDF now includes branded headers, KPI cards, a platform comparison chart and a clear ChatGPT improvement step.
- Account-level analytics without a linked post version caused a nullable database id to be decoded as a required post id; totals and platform charts now retain those metrics while Top Content safely includes only post-linked rows.
- Approval cards previously described creative direction but could not show attached media; they now display the real local thumbnail and label the CTA as a separate human-review field.
- The AI workspace now detects an optional local Ollama runtime and can run an installed on-device model without an AI API key; it clearly reports when no runtime/model is installed and preserves manual ChatGPT copy/import.
- Accounts marked `connected` previously still passed through the Mock adapter; version 0.2.0 now dispatches to the correct official adapter, reads the authorized token from Keychain, sends attached media, composes hook/caption/CTA/hashtags and records the real external ID.
- Official analytics previously had only a Mock collector; the Analytics screen now has a separate connected-platform collector with platform-specific normalization and clear partial-failure reporting.
- The account cards displayed “No client selected” after a client was selected but before an account existed; they now show the selected client immediately.
- Version 0.3.0 adds a Release Readiness screen that executes the remaining database, Keychain, platform-validation, real-publish, analytics, duplicate-log, code-signing and notarization checks and exports the result as local JSON.
- Version 0.3.2 keeps Official Connect available while Mock Mode is active and securely stores optional refresh credentials in Keychain so supported platforms can refresh expiring access tokens before unattended publishing.

## Honest limitations

1. **Official social adapters are implemented, but no owner account is activated.** Version 0.2.0 validates an authorized token, stores it in Keychain, dispatches real publishing by platform and collects supported analytics. Instagram/Facebook, LinkedIn and YouTube still require owner-created developer applications, user authorization and sometimes platform review. No live account was supplied, so live platform success is not claimed. Mock Mode is fully tested.
2. **Built-in branded OAuth login remains external-configuration work.** Secure authorized-token connection and refresh-token handling work. A branded browser consent/login flow still requires each platform's registered OAuth client ID, redirect URI and approval. SQLite stores only a Keychain reference; secrets remain in macOS Keychain.
3. **Closed-app scheduling is opt-in.** The local LaunchAgent can run scheduler checks after the app closes or the Mac restarts, but the user must enable it in Settings. The Mac must be awake and logged in; network publishing still depends on platform availability.
4. **Distribution is local-development grade.** The `.app` is ad-hoc signed for this Mac. The notarization script is implemented, but Apple Developer ID signing and notarization cannot execute without the owner's Apple certificate and notary profile.
5. **PDF reports are professional but intentionally local.** They now include KPI cards and a platform chart; advanced multi-page layouts and arbitrary client font embedding remain future enhancements.

These limitations do not introduce an AI API dependency and do not weaken the mandatory human-approval workflow.

## Security audit

- no AI SDK/key or hidden AI network call
- no social password fields
- mock publishing is the default
- Autopilot is off by default and still requires manual ChatGPT copy/import
- SQLite foreign keys and constrained states enabled
- generated media paths and upload allow-list/size validation
- local backup restore integrity check and safety copy
- official token storage uses macOS Keychain; SQLite stores only opaque references

## Recommended future work

1. Activate one official platform at a time, beginning with Meta, only after creating the official developer app and testing OAuth on a non-production account.
2. Complete Developer ID signing, notarization, DMG packaging and a tested update strategy using the product owner's Apple developer identity.
3. Add platform contract fixtures against official sandbox/test accounts.
4. Expand PDF reports with additional pages and optional client branding.
