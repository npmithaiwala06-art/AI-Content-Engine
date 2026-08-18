CREATE TABLE IF NOT EXISTS ai_prompts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'manual_chatgpt'
        CHECK (provider = 'manual_chatgpt'),
    template_type TEXT NOT NULL
        CHECK (template_type IN ('single_post', '7_day', '15_day', '30_day', 'campaign')),
    goal TEXT NOT NULL,
    topic TEXT NOT NULL,
    content_type TEXT NOT NULL,
    tone TEXT NOT NULL,
    platforms TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(platforms)),
    post_count INTEGER NOT NULL CHECK (post_count BETWEEN 1 AND 100),
    start_date TEXT,
    end_date TEXT,
    prompt_text TEXT NOT NULL,
    output_format_version TEXT NOT NULL DEFAULT 'social_content_v1',
    copy_count INTEGER NOT NULL DEFAULT 0 CHECK (copy_count >= 0),
    last_copied_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_client_created
    ON ai_prompts(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_campaign
    ON ai_prompts(campaign_id, created_at DESC);

INSERT INTO schema_migrations (version, name) VALUES (3, 'ai_workspace');
