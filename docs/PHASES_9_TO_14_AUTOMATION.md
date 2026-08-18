# Phases 9–14 — Local Automation

- A 15-second local worker recovers interrupted jobs, finds due schedules and publishes a bounded queue.
- SQLite idempotency and unique queue constraints prevent duplicate publishing.
- Instagram, Facebook, LinkedIn and YouTube have isolated official adapter placeholders; Mock Mode is fully operational.
- Mock accounts support success, one-shot failure, exponential retry, fake external IDs and local publishing logs.
- Publishing Queue supports retry, cancel and Publish Now. Scheduled and Published views are separate.
- Success/failure records appear in the in-app notification panel and macOS Notification Center via local `osascript` notifications.
- Official Connect validates and stores an already-authorized platform token. Each owner must still configure the platform's developer app/OAuth and permissions. No AI key is involved.
