INSERT OR IGNORE INTO platforms (id, display_name, adapter_key, is_enabled, is_initial)
VALUES ('twitter', 'Twitter', 'twitter', 1, 1);

UPDATE publishing_queue
SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
WHERE schedule_id IN (
    SELECT s.id
    FROM schedules s
    JOIN post_versions pv ON pv.id = s.post_version_id
    WHERE pv.platform_id = 'linkedin'
) AND status IN ('queued', 'retrying', 'publishing', 'failed');

UPDATE schedules
SET status = 'cancelled', locked_at = NULL, updated_at = CURRENT_TIMESTAMP
WHERE post_version_id IN (
    SELECT id FROM post_versions WHERE platform_id = 'linkedin'
) AND status NOT IN ('completed', 'cancelled');

UPDATE posts
SET status = 'approved', updated_at = CURRENT_TIMESTAMP
WHERE status IN ('scheduled', 'publishing', 'failed', 'paused')
  AND id IN (SELECT post_id FROM post_versions WHERE platform_id = 'linkedin')
  AND NOT EXISTS (
      SELECT 1
      FROM post_versions pv
      JOIN schedules s ON s.post_version_id = pv.id
      WHERE pv.post_id = posts.id AND s.status NOT IN ('completed', 'cancelled')
  );

UPDATE social_accounts
SET platform_id = 'twitter',
    account_name = account_name || ' — reconnect Twitter',
    external_account_id = NULL,
    connection_status = 'disconnected',
    auth_storage_key = NULL,
    token_expires_at = NULL,
    settings = '{"mode":"reconnect_required","migrated_from":"linkedin"}',
    updated_at = CURRENT_TIMESTAMP
WHERE platform_id = 'linkedin';

UPDATE post_versions SET platform_id = 'twitter', updated_at = CURRENT_TIMESTAMP
WHERE platform_id = 'linkedin';

UPDATE clients SET main_platforms = replace(main_platforms, '"linkedin"', '"twitter"')
WHERE instr(main_platforms, '"linkedin"') > 0;

UPDATE ai_prompts SET platforms = replace(platforms, '"linkedin"', '"twitter"'), updated_at = CURRENT_TIMESTAMP
WHERE instr(platforms, '"linkedin"') > 0;

UPDATE media SET platform_ids = replace(platform_ids, '"linkedin"', '"twitter"'), updated_at = CURRENT_TIMESTAMP
WHERE instr(platform_ids, '"linkedin"') > 0;

UPDATE campaigns SET platforms = replace(platforms, '"linkedin"', '"twitter"'), updated_at = CURRENT_TIMESTAMP
WHERE instr(platforms, '"linkedin"') > 0;

DELETE FROM platforms WHERE id = 'linkedin';

DELETE FROM platforms
WHERE id = 'x'
  AND NOT EXISTS (SELECT 1 FROM social_accounts WHERE platform_id = 'x')
  AND NOT EXISTS (SELECT 1 FROM post_versions WHERE platform_id = 'x');

INSERT INTO schema_migrations (version, name)
VALUES (11, 'replace_linkedin_with_twitter');
