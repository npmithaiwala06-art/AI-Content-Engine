ALTER TABLE clients ADD COLUMN brand_name TEXT;
ALTER TABLE clients ADD COLUMN main_platforms TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(main_platforms));
ALTER TABLE clients ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused'));

ALTER TABLE brand_profiles ADD COLUMN content_style TEXT;
ALTER TABLE brand_profiles ADD COLUMN keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(keywords));
ALTER TABLE brand_profiles ADD COLUMN fonts TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(fonts));
ALTER TABLE brand_profiles ADD COLUMN logo_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_status_activity ON clients(archived_at, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_logo ON brand_profiles(logo_media_id);

INSERT INTO schema_migrations (version, name) VALUES (2, 'clients_and_brand_profiles');
