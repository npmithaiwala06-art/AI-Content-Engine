ALTER TABLE media ADD COLUMN platform_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(platform_ids));
ALTER TABLE media ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_media_client_created ON media(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_kind_created ON media(kind, created_at DESC);

INSERT INTO schema_migrations (version, name) VALUES (5, 'media_library');
