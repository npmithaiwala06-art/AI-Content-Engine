INSERT OR IGNORE INTO platforms (id, display_name, adapter_key, is_enabled, is_initial)
VALUES ('twitter', 'Twitter', 'twitter', 1, 1);

UPDATE clients
SET main_platforms = (
    SELECT json_group_array(platform)
    FROM (
        SELECT DISTINCT CASE value WHEN 'x' THEN 'twitter' ELSE value END AS platform
        FROM json_each(clients.main_platforms)
    )
)
WHERE EXISTS (SELECT 1 FROM json_each(clients.main_platforms) WHERE value = 'x');

-- Migration 012 temporarily made X the canonical key. If both keys exist for the
-- same provider account, preserve the newer canonical-X record and move local
-- references before restoring the supported `twitter` key. OR IGNORE keeps an
-- already-equivalent schedule/analytics row rather than aborting application
-- startup on a uniqueness collision.
UPDATE post_versions
SET social_account_id = (
    SELECT source.id
    FROM social_accounts AS target
    JOIN social_accounts AS source
      ON source.client_id = target.client_id
     AND source.external_account_id = target.external_account_id
     AND source.platform_id = 'x'
    WHERE target.id = post_versions.social_account_id
      AND target.platform_id = 'twitter'
)
WHERE social_account_id IN (
    SELECT target.id
    FROM social_accounts AS target
    JOIN social_accounts AS source
      ON source.client_id = target.client_id
     AND source.external_account_id = target.external_account_id
     AND source.platform_id = 'x'
    WHERE target.platform_id = 'twitter'
);

UPDATE OR IGNORE schedules
SET social_account_id = (
    SELECT source.id
    FROM social_accounts AS target
    JOIN social_accounts AS source
      ON source.client_id = target.client_id
     AND source.external_account_id = target.external_account_id
     AND source.platform_id = 'x'
    WHERE target.id = schedules.social_account_id
      AND target.platform_id = 'twitter'
)
WHERE social_account_id IN (
    SELECT target.id
    FROM social_accounts AS target
    JOIN social_accounts AS source
      ON source.client_id = target.client_id
     AND source.external_account_id = target.external_account_id
     AND source.platform_id = 'x'
    WHERE target.platform_id = 'twitter'
);

UPDATE OR IGNORE analytics
SET social_account_id = (
    SELECT source.id
    FROM social_accounts AS target
    JOIN social_accounts AS source
      ON source.client_id = target.client_id
     AND source.external_account_id = target.external_account_id
     AND source.platform_id = 'x'
    WHERE target.id = analytics.social_account_id
      AND target.platform_id = 'twitter'
)
WHERE social_account_id IN (
    SELECT target.id
    FROM social_accounts AS target
    JOIN social_accounts AS source
      ON source.client_id = target.client_id
     AND source.external_account_id = target.external_account_id
     AND source.platform_id = 'x'
    WHERE target.platform_id = 'twitter'
);

DELETE FROM social_accounts AS target
WHERE target.platform_id = 'twitter'
  AND EXISTS (
      SELECT 1
      FROM social_accounts AS source
      WHERE source.platform_id = 'x'
        AND source.client_id = target.client_id
        AND source.external_account_id = target.external_account_id
  );

UPDATE social_accounts
SET platform_id = 'twitter', updated_at = CURRENT_TIMESTAMP
WHERE platform_id = 'x';

UPDATE post_versions
SET platform_id = 'twitter', updated_at = CURRENT_TIMESTAMP
WHERE platform_id = 'x';

UPDATE ai_prompts
SET platforms = (
    SELECT json_group_array(platform)
    FROM (
        SELECT DISTINCT CASE value WHEN 'x' THEN 'twitter' ELSE value END AS platform
        FROM json_each(ai_prompts.platforms)
    )
), updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM json_each(ai_prompts.platforms) WHERE value = 'x');

UPDATE media
SET platform_ids = (
    SELECT json_group_array(platform)
    FROM (
        SELECT DISTINCT CASE value WHEN 'x' THEN 'twitter' ELSE value END AS platform
        FROM json_each(media.platform_ids)
    )
), updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM json_each(media.platform_ids) WHERE value = 'x');

UPDATE campaigns
SET platforms = (
    SELECT json_group_array(platform)
    FROM (
        SELECT DISTINCT CASE value WHEN 'x' THEN 'twitter' ELSE value END AS platform
        FROM json_each(campaigns.platforms)
    )
), updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM json_each(campaigns.platforms) WHERE value = 'x');

DELETE FROM platforms
WHERE id = 'x'
  AND NOT EXISTS (SELECT 1 FROM social_accounts WHERE platform_id = 'x')
  AND NOT EXISTS (SELECT 1 FROM post_versions WHERE platform_id = 'x');

INSERT INTO schema_migrations (version, name)
VALUES (13, 'restore_twitter_platform');
