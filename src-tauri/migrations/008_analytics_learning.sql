ALTER TABLE analytics ADD COLUMN followers INTEGER;
ALTER TABLE analytics ADD COLUMN campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE analytics ADD COLUMN content_type TEXT;

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period_start TEXT,
    period_end TEXT,
    findings TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(findings)),
    successful_topics TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(successful_topics)),
    weak_topics TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(weak_topics)),
    successful_formats TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(successful_formats)),
    weak_formats TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(weak_formats)),
    posting_recommendations TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(posting_recommendations)),
    strategy_recommendations TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(strategy_recommendations)),
    future_ideas TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(future_ideas)),
    raw_content TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_client ON ai_recommendations(client_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_filters ON analytics(client_id,period_start,period_end,content_type);

INSERT INTO schema_migrations (version, name) VALUES (8, 'analytics_learning');
