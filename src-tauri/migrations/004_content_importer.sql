CREATE TABLE IF NOT EXISTS content_imports (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    ai_prompt_id TEXT REFERENCES ai_prompts(id) ON DELETE SET NULL,
    source_format TEXT NOT NULL DEFAULT 'social_content_v1',
    raw_content TEXT NOT NULL,
    parsed_post_count INTEGER NOT NULL DEFAULT 0 CHECK (parsed_post_count >= 0),
    saved_post_count INTEGER NOT NULL DEFAULT 0 CHECK (saved_post_count >= 0),
    duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
    status TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed', 'saved', 'failed')),
    validation_errors TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(validation_errors)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

ALTER TABLE posts ADD COLUMN import_batch_id TEXT REFERENCES content_imports(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN import_fingerprint TEXT;
ALTER TABLE posts ADD COLUMN proposed_publish_at TEXT;
ALTER TABLE posts ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

CREATE INDEX IF NOT EXISTS idx_content_imports_client_created ON content_imports(client_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_client_import_fingerprint
    ON posts(client_id, import_fingerprint)
    WHERE import_fingerprint IS NOT NULL AND deleted_at IS NULL;

INSERT INTO schema_migrations (version, name) VALUES (4, 'content_importer');
