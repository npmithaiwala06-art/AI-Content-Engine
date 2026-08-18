CREATE TABLE IF NOT EXISTS publishing_queue (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL UNIQUE REFERENCES schedules(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','publishing','published','failed','retrying','cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TEXT,
    last_error TEXT,
    external_post_id TEXT,
    locked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queue_status_attempt ON publishing_queue(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read,created_at DESC);

INSERT OR IGNORE INTO settings(key,value,category) VALUES
 ('scheduler.enabled','true','scheduler'),
 ('scheduler.interval_seconds','15','scheduler'),
 ('notifications.enabled','true','notifications');

INSERT INTO schema_migrations (version, name) VALUES (7, 'automation_engine');
