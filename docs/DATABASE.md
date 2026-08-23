# SQLite database design

SQLite is the production source of truth. The desktop database lives at:

```text
/Users/neevmithaiwala/Library/Application Support/com.socialflow.localos/socialflow.sqlite
```

## Migrations

The ordered runner applies every migration in a transaction:

1. `001_initial_schema.sql` — complete product entities, relations, state checks and defaults
2. `002_clients_and_brand_profiles.sql` — client fields, Brand Profile fields and logos
3. `003_ai_workspace.sql` — manual ChatGPT prompt history
4. `004_content_importer.sql` — import batches, fingerprints and proposed dates
5. `005_media_library.sql` — media tags/platforms and indexes
6. `006_calendar_and_idempotency.sql` — durable calendar uniqueness and retry metadata
7. `007_automation_engine.sql` — publishing queue, notifications and automation settings
8. `008_analytics_learning.sql` — analytics normalization and AI recommendations
9. `009_reports_export.sql` — report snapshots and export paths
10. `010_campaigns_plans.sql` — complete campaign and bulk-plan fields/indexes

Never edit a released migration. Add the next numbered migration and register it in `database.rs`.

## Relationships

```text
clients 1──1 brand_profiles
clients 1──* social_accounts *──1 platforms
clients 1──* campaigns
clients 1──* content_plans
clients 1──* posts 1──* post_versions *──1 platforms
post_versions *──* media (post_media)
posts 1──* approvals
post_versions 1──* schedules 1──1 publishing_queue
schedules 1──* publishing_logs
clients 1──* analytics
clients 1──* ai_recommendations
clients 1──* reports
clients 1──* ai_prompts
clients 1──* content_imports
clients 1──* activity_logs
```

`posts` stores the shared idea and lifecycle; `post_versions` stores independent Instagram, Facebook, Twitter and YouTube copy. Approval records are append-only decisions. Schedules and queue records survive application restarts.

## State machines

```text
Post: draft → needs_review → approved → scheduled → publishing → published
                  └→ rejected       └→ paused        └→ failed

Queue: queued → publishing → published
          └→ retrying → failed
          └→ cancelled
```

Service functions enforce transitions. Direct arbitrary UI status writes are not exposed.

## Integrity and performance

- foreign-key enforcement and cascade behavior are tested
- one queue record per schedule prevents duplicate publication
- import fingerprints prevent repeated active imports per client
- indexes cover client/status, queue due dates, media, analytics, campaigns and search paths
- JSON columns use `json_valid` constraints
- a native stress test inserts 2,500 posts across five clients, verifies filtered queries and checks cascades
- backup uses SQLite `VACUUM INTO`; restore runs `PRAGMA integrity_check`

## Secret handling

The database never stores social passwords. `social_accounts.auth_storage_key` is reserved to reference macOS Keychain when real OAuth is implemented. Mock settings contain only non-secret test controls. There is no AI credential table or AI API key setting.
