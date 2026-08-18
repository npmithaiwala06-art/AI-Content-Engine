PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT,
    industry TEXT,
    location TEXT,
    website TEXT,
    business_description TEXT,
    products TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(products)),
    services TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(services)),
    target_audience TEXT,
    marketing_goals TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(marketing_goals)),
    competitors TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(competitors)),
    preferred_content TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(preferred_content)),
    posting_frequency TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(posting_frequency)),
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT
);

CREATE TABLE IF NOT EXISTS brand_profiles (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    brand_voice TEXT,
    brand_personality TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(brand_personality)),
    primary_audience TEXT,
    main_offering TEXT,
    preferred_cta TEXT,
    avoid_topics TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(avoid_topics)),
    preferred_phrases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(preferred_phrases)),
    brand_colours TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(brand_colours)),
    typography TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(typography)),
    content_rules TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(content_rules)),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS platforms (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    adapter_key TEXT NOT NULL UNIQUE,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    is_initial INTEGER NOT NULL DEFAULT 0 CHECK (is_initial IN (0, 1))
);

INSERT OR IGNORE INTO platforms (id, display_name, adapter_key, is_initial) VALUES
    ('instagram', 'Instagram', 'instagram', 1),
    ('facebook', 'Facebook', 'facebook', 1),
    ('linkedin', 'LinkedIn', 'linkedin', 1),
    ('youtube', 'YouTube', 'youtube', 1),
    ('x', 'X', 'x', 0),
    ('threads', 'Threads', 'threads', 0),
    ('tiktok', 'TikTok', 'tiktok', 0),
    ('pinterest', 'Pinterest', 'pinterest', 0),
    ('google_business_profile', 'Google Business Profile', 'google_business_profile', 0),
    ('whatsapp_channels', 'WhatsApp Channels', 'whatsapp_channels', 0);

CREATE TABLE IF NOT EXISTS social_accounts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE RESTRICT,
    account_name TEXT NOT NULL,
    external_account_id TEXT,
    connection_status TEXT NOT NULL DEFAULT 'disconnected'
        CHECK (connection_status IN ('disconnected', 'connecting', 'connected', 'expired', 'error', 'mock')),
    auth_storage_key TEXT,
    token_expires_at TEXT,
    last_validated_at TEXT,
    settings TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(client_id, platform_id, external_account_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    objective TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS content_plans (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('single', '7_day', '15_day', '30_day', 'campaign')),
    start_date TEXT,
    end_date TEXT,
    goal TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    content_plan_id TEXT REFERENCES content_plans(id) ON DELETE SET NULL,
    parent_idea_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
    title TEXT,
    core_idea TEXT,
    content_type TEXT NOT NULL,
    goal TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'needs_review', 'approved', 'scheduled', 'publishing', 'published', 'rejected', 'failed', 'paused')),
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'chatgpt_import', 'template', 'duplicate')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS post_versions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE RESTRICT,
    social_account_id TEXT REFERENCES social_accounts(id) ON DELETE SET NULL,
    hook TEXT,
    caption TEXT,
    cta TEXT,
    hashtags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(hashtags)),
    title TEXT,
    description TEXT,
    keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(keywords)),
    creative_idea TEXT,
    image_prompt TEXT,
    thumbnail_concept TEXT,
    platform_metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(platform_metadata)),
    version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(post_id, platform_id, version_number)
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'logo', 'brand_asset', 'creative', 'document')),
    file_name TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    mime_type TEXT,
    file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    width INTEGER,
    height INTEGER,
    duration_seconds REAL,
    checksum TEXT,
    tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS post_media (
    post_version_id TEXT NOT NULL REFERENCES post_versions(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'thumbnail', 'attachment')),
    PRIMARY KEY (post_version_id, media_id)
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('submitted', 'approved', 'rejected', 'changes_requested')),
    notes TEXT,
    decided_by TEXT NOT NULL DEFAULT 'local_user',
    decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    post_version_id TEXT NOT NULL REFERENCES post_versions(id) ON DELETE CASCADE,
    social_account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    scheduled_for TEXT NOT NULL,
    timezone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'paused', 'cancelled')),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
    next_retry_at TEXT,
    locked_at TEXT,
    locked_by TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(post_version_id, social_account_id, scheduled_for)
);

CREATE TABLE IF NOT EXISTS publishing_logs (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    adapter_key TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
    external_post_id TEXT,
    request_summary TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_summary)),
    response_summary TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(response_summary)),
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS analytics (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    social_account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    post_version_id TEXT REFERENCES post_versions(id) ON DELETE SET NULL,
    external_post_id TEXT,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    reach INTEGER,
    impressions INTEGER,
    views INTEGER,
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    saves INTEGER,
    clicks INTEGER,
    followers_gained INTEGER,
    watch_time_seconds REAL,
    engagement_rate REAL,
    raw_metrics TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(raw_metrics)),
    UNIQUE(social_account_id, post_version_id, period_start, period_end, collected_at)
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'campaign', 'client')),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    metrics_snapshot TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metrics_snapshot)),
    analysis_prompt TEXT,
    imported_analysis TEXT,
    recommendations TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(recommendations)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL CHECK (json_valid(value)),
    category TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO settings (key, value, category) VALUES
    ('publishing.mock_mode', 'true', 'publishing'),
    ('approval.autopilot_enabled', 'false', 'approval'),
    ('privacy.ai_api_enabled', 'false', 'privacy'),
    ('scheduler.max_retries', '3', 'scheduler');

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_client ON social_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_status ON campaigns(client_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_client_status ON posts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_plan ON posts(content_plan_id);
CREATE INDEX IF NOT EXISTS idx_post_versions_post_platform ON post_versions(post_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_media_client_kind ON media(client_id, kind);
CREATE INDEX IF NOT EXISTS idx_approvals_post_time ON approvals(post_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_due ON schedules(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_publishing_logs_schedule ON publishing_logs(schedule_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_analytics_client_period ON analytics(client_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_activity_recent ON activity_logs(created_at DESC);

INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (1, 'initial_schema');
