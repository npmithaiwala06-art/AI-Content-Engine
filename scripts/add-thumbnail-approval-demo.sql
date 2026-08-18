PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

DELETE FROM posts WHERE id = 'demo-post-thumbnail-review';
DELETE FROM media WHERE id = 'demo-media-cold-brew-thumbnail';

INSERT INTO media (
  id,client_id,campaign_id,kind,file_name,relative_path,mime_type,
  file_size_bytes,width,height,checksum,tags,platform_ids,created_at,updated_at
) VALUES (
  'demo-media-cold-brew-thumbnail','demo-client-abc-cafe',
  'demo-campaign-weekend','creative','abc-cafe-cold-brew-thumbnail.png',
  'media/clients/demo-client-abc-cafe/generated/abc-cafe-cold-brew-thumbnail.png',
  'image/png',2116400,1672,941,
  '9eecc0046c7a2ce42a40a71e2a790d21449c6bcc534311d406983dd9986feb0a',
  '["demo","cold brew","thumbnail","generated creative"]',
  '["youtube"]','2026-08-17T20:00:00+05:30','2026-08-17T20:00:00+05:30'
);

INSERT INTO posts (
  id,client_id,campaign_id,content_plan_id,title,core_idea,content_type,
  goal,status,source,proposed_publish_at,timezone,created_at,updated_at
) VALUES (
  'demo-post-thumbnail-review','demo-client-abc-cafe',
  'demo-campaign-weekend','demo-plan-seven-day',
  'How We Make Cold Brew — Thumbnail Review DEMO',
  'Explain the cold-brew process and turn viewer interest into a weekend cafe visit',
  'short_video','Build product interest and weekend visits','needs_review',
  'manual','2026-08-21T17:30:00','Asia/Kolkata',
  '2026-08-17T20:00:00+05:30','2026-08-17T20:00:00+05:30'
);

INSERT INTO post_versions (
  id,post_id,platform_id,social_account_id,hook,caption,cta,hashtags,
  title,description,keywords,creative_idea,image_prompt,thumbnail_concept,
  platform_metadata,version_number,created_at,updated_at
) VALUES (
  'demo-version-thumbnail-youtube','demo-post-thumbnail-review','youtube',
  'demo-account-youtube','Why does cold brew taste smoother than regular iced coffee?',
  'Go behind the counter at ABC Cafe and see how time, temperature and careful steeping create our smooth weekend cold brew.',
  'Watch the full process, then visit ABC Cafe this weekend.',
  '["#ColdBrew","#CoffeeProcess","#SuratCafe","#ABCCafe"]',
  'How We Make Smooth Cold Brew at ABC Cafe',
  'A quick behind-the-scenes guide to the cold-brew process, from steeping to the final ice-cold pour.',
  '["how cold brew is made","cold brew process","Surat cafe","ABC Cafe"]',
  'Fast-paced process shots: beans, steeping jar, filtration and the final pour over ice.',
  'Premium commercial cafe photograph of rich cold brew pouring over ice beside a steeping jar, warm amber lighting, subtle violet accents, no logo.',
  'Large HOW WE MAKE COLD BREW headline beside a close-up iced cold brew pour.',
  '{"demo":true,"generated_in_chatgpt_workspace":true}',1,
  '2026-08-17T20:00:00+05:30','2026-08-17T20:00:00+05:30'
);

INSERT INTO post_media(post_version_id,media_id,sort_order,role)
VALUES ('demo-version-thumbnail-youtube','demo-media-cold-brew-thumbnail',0,'thumbnail');

INSERT INTO approvals(id,post_id,decision,notes,decided_by,decided_at)
VALUES (
  'demo-approval-thumbnail-submitted','demo-post-thumbnail-review','submitted',
  'Review the generated thumbnail, hook, caption and CTA before approval.',
  'local_user','2026-08-17T20:00:00+05:30'
);

INSERT INTO activity_logs(
  id,client_id,entity_type,entity_id,action,summary,metadata,created_at
) VALUES (
  'demo-activity-thumbnail-review','demo-client-abc-cafe','post',
  'demo-post-thumbnail-review','submitted',
  'Cold-brew thumbnail and CTA submitted for human approval',
  '{"demo":true,"thumbnail":true}','2026-08-17T20:00:00+05:30'
);

INSERT INTO notifications(
  id,kind,title,body,entity_type,entity_id,is_read,created_at
) VALUES (
  'demo-notification-thumbnail-review','approval_required',
  'Thumbnail demo needs approval',
  'Review the cold-brew thumbnail, platform copy and CTA.',
  'post','demo-post-thumbnail-review',0,'2026-08-17T20:00:00+05:30'
);

COMMIT;
