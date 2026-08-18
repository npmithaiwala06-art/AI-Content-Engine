ALTER TABLE campaigns ADD COLUMN audience TEXT;
ALTER TABLE campaigns ADD COLUMN platforms TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(platforms));
ALTER TABLE campaigns ADD COLUMN budget REAL CHECK (budget IS NULL OR budget >= 0);

CREATE INDEX IF NOT EXISTS idx_content_plans_client_status ON content_plans(client_id,status,created_at DESC);

INSERT INTO schema_migrations (version, name) VALUES (10, 'campaigns_plans');
