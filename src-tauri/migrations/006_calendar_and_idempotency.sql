ALTER TABLE schedules ADD COLUMN idempotency_key TEXT;
ALTER TABLE schedules ADD COLUMN last_attempt_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_idempotency ON schedules(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_calendar ON schedules(scheduled_for, status);

INSERT INTO schema_migrations (version, name) VALUES (6, 'calendar_and_idempotency');
