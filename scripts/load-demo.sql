PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

-- This script only resets records owned by this clearly labelled demo client.
DELETE FROM clients WHERE id = 'demo-client-abc-cafe';

INSERT INTO clients (
  id, name, company_name, brand_name, industry, location, website,
  business_description, products, services, target_audience,
  marketing_goals, competitors, preferred_content, posting_frequency,
  timezone, main_platforms, status, created_at, updated_at
) VALUES (
  'demo-client-abc-cafe', 'ABC Cafe — DEMO', 'ABC Foods Demo Pvt. Ltd.',
  'ABC Cafe', 'Cafe & Restaurant', 'Surat, Gujarat', 'https://example.com',
  'A fictional neighbourhood cafe used to demonstrate SocialFlow OS safely.',
  '["Specialty coffee","Cold brews","Breakfast bowls"]',
  '["Dine-in","Takeaway","Small events"]',
  'College students and young professionals in Surat',
  '["Increase weekend visits","Grow local brand awareness"]',
  '["Local coffee chains","Independent cafes"]',
  '["Food photography","Short reels","Educational carousels"]',
  '"4 posts per week"', 'Asia/Kolkata',
  '["instagram","facebook","twitter","youtube"]', 'active',
  '2026-08-17T10:00:00+05:30', '2026-08-17T19:35:00+05:30'
);

INSERT INTO brand_profiles (
  id, client_id, brand_voice, brand_personality, primary_audience,
  main_offering, preferred_cta, avoid_topics, preferred_phrases,
  brand_colours, typography, content_rules, content_style, keywords,
  fonts, updated_at
) VALUES (
  'demo-brand-abc-cafe', 'demo-client-abc-cafe',
  'Friendly, energetic and locally relevant',
  '["Welcoming","Playful","Optimistic"]',
  'College students and young professionals in Surat',
  'Specialty coffee and weekend brunch', 'Visit us this weekend',
  '["Overly formal language","Unsupported health claims"]',
  '["Made for Surat","Your weekend coffee stop"]',
  '["#6D4AFF","#F59E0B","#FFF7E8"]',
  '{"heading":"Manrope","body":"DM Sans"}',
  '{"always_include_local_context":true,"approval_required":true}',
  'Warm food photography, short reels and clear offer-led stories',
  '["coffee","Surat cafe","weekend brunch","cold brew"]',
  '["Manrope","DM Sans"]', '2026-08-17T19:35:00+05:30'
);

INSERT INTO campaigns (
  id, client_id, name, description, objective, start_date, end_date,
  status, audience, platforms, budget, created_at, updated_at
) VALUES (
  'demo-campaign-weekend', 'demo-client-abc-cafe', 'Weekend Coffee Boost — DEMO',
  'A safe demonstration campaign promoting weekend cafe visits.',
  'Increase weekend walk-ins', '2026-08-17', '2026-08-31', 'active',
  'Students and young professionals in Surat',
  '["instagram","facebook","twitter","youtube"]', 5000,
  '2026-08-17T10:10:00+05:30', '2026-08-17T19:35:00+05:30'
);

INSERT INTO content_plans (
  id, client_id, campaign_id, name, plan_type, start_date, end_date,
  goal, status, created_at, updated_at
) VALUES (
  'demo-plan-seven-day', 'demo-client-abc-cafe', 'demo-campaign-weekend',
  '7-Day Weekend Warm-up — DEMO', '7_day', '2026-08-17', '2026-08-23',
  'Build awareness and weekend visits', 'active',
  '2026-08-17T10:15:00+05:30', '2026-08-17T19:35:00+05:30'
);

INSERT INTO social_accounts (
  id, client_id, platform_id, account_name, external_account_id,
  connection_status, last_validated_at, settings, created_at, updated_at
) VALUES
  ('demo-account-instagram','demo-client-abc-cafe','instagram','@abccafe_demo','demo-ig','mock','2026-08-17T19:35:00+05:30','{"fail_next":false}','2026-08-17T10:20:00+05:30','2026-08-17T19:35:00+05:30'),
  ('demo-account-facebook','demo-client-abc-cafe','facebook','ABC Cafe Demo Page','demo-fb','mock','2026-08-17T19:35:00+05:30','{"fail_next":false}','2026-08-17T10:20:00+05:30','2026-08-17T19:35:00+05:30'),
  ('demo-account-twitter','demo-client-abc-cafe','twitter','@abccafe_demo','demo-twitter','mock','2026-08-17T19:35:00+05:30','{"fail_next":false}','2026-08-17T10:20:00+05:30','2026-08-17T19:35:00+05:30'),
  ('demo-account-youtube','demo-client-abc-cafe','youtube','ABC Cafe Demo Channel','demo-yt','mock','2026-08-17T19:35:00+05:30','{"fail_next":false}','2026-08-17T10:20:00+05:30','2026-08-17T19:35:00+05:30');

INSERT INTO ai_prompts (
  id, client_id, campaign_id, provider, template_type, goal, topic,
  content_type, tone, platforms, post_count, start_date, end_date,
  prompt_text, output_format_version, copy_count, last_copied_at,
  created_at, updated_at
) VALUES (
  'demo-ai-prompt', 'demo-client-abc-cafe', 'demo-campaign-weekend',
  'manual_chatgpt', '7_day', 'Increase weekend visitors',
  'Weekend coffee experience', 'mixed', 'Friendly and energetic',
  '["instagram","facebook","twitter","youtube"]', 7,
  '2026-08-17', '2026-08-23',
  'DEMO PROMPT: Create seven platform-specific posts for ABC Cafe. Keep Instagram visual, Facebook conversational, Twitter concise and timely, and YouTube searchable. Return social_content_v1 JSON.',
  'social_content_v1', 1, '2026-08-17T11:00:00+05:30',
  '2026-08-17T10:30:00+05:30', '2026-08-17T11:00:00+05:30'
);

-- Published example.
INSERT INTO posts (
  id, client_id, campaign_id, content_plan_id, title, core_idea,
  content_type, goal, status, source, proposed_publish_at, timezone,
  created_at, updated_at
) VALUES (
  'demo-post-published', 'demo-client-abc-cafe', 'demo-campaign-weekend',
  'demo-plan-seven-day', 'Cold Brew Friday — DEMO',
  'Invite local customers to try the weekend cold brew', 'image_post',
  'Increase weekend visits', 'published', 'chatgpt_import',
  '2026-08-15T17:30:00', 'Asia/Kolkata',
  '2026-08-14T10:00:00+05:30', '2026-08-15T17:31:00+05:30'
);
INSERT INTO post_versions (
  id, post_id, platform_id, social_account_id, hook, caption, cta,
  hashtags, title, description, keywords, creative_idea, image_prompt,
  thumbnail_concept, platform_metadata, version_number, created_at, updated_at
) VALUES (
  'demo-version-published-ig','demo-post-published','instagram','demo-account-instagram',
  'Surat, your Friday cool-down is ready. 🧊',
  'Slow down, sip something smooth, and start your weekend at ABC Cafe. Our cold brew is steeped for a bold, refreshing finish.',
  'Visit us this weekend',
  '["#SuratCafe","#ColdBrew","#WeekendInSurat","#ABCCafe"]',
  'Cold Brew Friday','A published Mock Mode demonstration post.',
  '["cold brew","Surat cafe"]','Close-up cold brew with warm cafe background',
  'Commercial food photograph of a cold brew glass, condensation, warm cafe light, violet and amber brand accents, no text',
  'Cold brew glass with FRIDAY overlay','{"demo":true}',1,
  '2026-08-14T10:00:00+05:30','2026-08-15T17:31:00+05:30'
);
INSERT INTO approvals (id,post_id,decision,notes,decided_by,decided_at)
VALUES ('demo-approval-published','demo-post-published','approved','Demo content reviewed and approved','local_user','2026-08-15T16:00:00+05:30');
INSERT INTO schedules (
  id,post_version_id,social_account_id,scheduled_for,timezone,status,
  retry_count,max_retries,idempotency_key,last_attempt_at,created_at,updated_at
) VALUES (
  'demo-schedule-published','demo-version-published-ig','demo-account-instagram',
  '2026-08-15T17:30:00','Asia/Kolkata','completed',0,3,
  'demo-published-instagram-20260815','2026-08-15T17:30:05+05:30',
  '2026-08-15T16:05:00+05:30','2026-08-15T17:30:06+05:30'
);
INSERT INTO publishing_queue (
  id,schedule_id,status,attempts,external_post_id,created_at,updated_at
) VALUES (
  'demo-queue-published','demo-schedule-published','published',1,
  'mock-instagram-demo-001','2026-08-15T17:30:00+05:30','2026-08-15T17:30:06+05:30'
);
INSERT INTO publishing_logs (
  id,schedule_id,attempt_number,adapter_key,started_at,finished_at,status,
  external_post_id,request_summary,response_summary,created_at
) VALUES (
  'demo-log-published','demo-schedule-published',1,'instagram',
  '2026-08-15T17:30:01+05:30','2026-08-15T17:30:06+05:30','succeeded',
  'mock-instagram-demo-001','{"mock":true}','{"message":"Mock publish successful"}',
  '2026-08-15T17:30:01+05:30'
);

-- Human review example with genuinely different Instagram and Facebook copy.
INSERT INTO posts (
  id,client_id,campaign_id,content_plan_id,title,core_idea,content_type,
  goal,status,source,proposed_publish_at,timezone,created_at,updated_at
) VALUES (
  'demo-post-review','demo-client-abc-cafe','demo-campaign-weekend',
  'demo-plan-seven-day','Weekend Brunch Invitation — DEMO',
  'Promote the cafe weekend brunch','carousel','Increase table visits',
  'needs_review','chatgpt_import','2026-08-19T11:00:00','Asia/Kolkata',
  '2026-08-17T11:20:00+05:30','2026-08-17T19:35:00+05:30'
);
INSERT INTO post_versions (
  id,post_id,platform_id,social_account_id,hook,caption,cta,hashtags,title,
  description,keywords,creative_idea,image_prompt,platform_metadata,created_at,updated_at
) VALUES
  ('demo-version-review-ig','demo-post-review','instagram','demo-account-instagram',
   'Brunch plans? Consider them sorted. ☕🥐',
   'Swipe through your next slow Saturday: fresh coffee, breakfast bowls and good company at ABC Cafe.',
   'Save this and visit us this weekend','["#SuratBrunch","#CafeHopping","#ABCCafe"]',
   'Weekend Brunch','Instagram carousel version','["brunch","Surat"]',
   'Four-slide food carousel with a warm opening cover',
   'Editorial brunch table photographed in warm morning light, violet accent napkin, no text','{"demo":true}',
   '2026-08-17T11:20:00+05:30','2026-08-17T19:35:00+05:30'),
  ('demo-version-review-fb','demo-post-review','facebook','demo-account-facebook',
   'Looking for an easy weekend plan in Surat?',
   'Bring your friends or family to ABC Cafe for a relaxed brunch, freshly brewed coffee and plenty of time to catch up.',
   'Message us or visit this weekend','["#SuratFoodies","#WeekendBrunch"]',
   'Weekend Brunch at ABC Cafe','Facebook conversational version','["weekend brunch"]',
   'Friendly table scene showing people sharing brunch',
   'Natural lifestyle photograph of friends sharing brunch in a modern Surat cafe, warm light, no text','{"demo":true}',
   '2026-08-17T11:20:00+05:30','2026-08-17T19:35:00+05:30');
INSERT INTO approvals (id,post_id,decision,notes,decided_by,decided_at)
VALUES ('demo-approval-submitted','demo-post-review','submitted','Waiting for your demo approval','local_user','2026-08-17T19:35:00+05:30');

-- Approved and safely scheduled for tomorrow; Mock Mode only.
INSERT INTO posts (
  id,client_id,campaign_id,content_plan_id,title,core_idea,content_type,
  goal,status,source,proposed_publish_at,timezone,created_at,updated_at
) VALUES (
  'demo-post-scheduled','demo-client-abc-cafe','demo-campaign-weekend',
  'demo-plan-seven-day','How We Make Cold Brew — DEMO',
  'Show the cold brew process','short_video','Build product interest',
  'scheduled','manual','2026-08-18T11:00:00','Asia/Kolkata',
  '2026-08-17T12:00:00+05:30','2026-08-17T19:35:00+05:30'
);
INSERT INTO post_versions (
  id,post_id,platform_id,social_account_id,hook,caption,cta,hashtags,title,
  description,keywords,creative_idea,image_prompt,thumbnail_concept,
  platform_metadata,created_at,updated_at
) VALUES (
  'demo-version-scheduled-yt','demo-post-scheduled','youtube','demo-account-youtube',
  'Why does cold brew taste so smooth?',
  'A quick behind-the-scenes look at how ABC Cafe prepares a balanced cold brew.',
  'Subscribe and visit ABC Cafe','["#ColdBrew","#CafeBehindTheScenes"]',
  'How ABC Cafe Makes Smooth Cold Brew','From steeping to serving, see the simple process behind our weekend favourite.',
  '["how to make cold brew","Surat cafe","coffee process"]',
  '30-second vertical process video with clean ingredient close-ups',
  'Cinematic coffee brewing process, close-up, warm cafe lighting, vertical video framing',
  'Cold brew jar with HOW IT IS MADE text','{"demo":true}',
  '2026-08-17T12:00:00+05:30','2026-08-17T19:35:00+05:30'
);
INSERT INTO approvals (id,post_id,decision,notes,decided_by,decided_at)
VALUES ('demo-approval-scheduled','demo-post-scheduled','approved','Approved for Mock Mode demonstration','local_user','2026-08-17T18:00:00+05:30');
INSERT INTO schedules (
  id,post_version_id,social_account_id,scheduled_for,timezone,status,retry_count,
  max_retries,idempotency_key,created_at,updated_at
) VALUES (
  'demo-schedule-upcoming','demo-version-scheduled-yt','demo-account-youtube',
  '2026-08-18T11:00:00','Asia/Kolkata','pending',0,3,
  'demo-youtube-20260818-1100','2026-08-17T18:05:00+05:30','2026-08-17T19:35:00+05:30'
);

-- One editable draft for Content Studio.
INSERT INTO posts (
  id,client_id,campaign_id,content_plan_id,title,core_idea,content_type,
  goal,status,source,proposed_publish_at,timezone,created_at,updated_at
) VALUES (
  'demo-post-draft','demo-client-abc-cafe','demo-campaign-weekend',
  'demo-plan-seven-day',
  'Coffee Meeting Tip — DEMO','Promote ABC Cafe as a casual meeting place',
  'text_post','Increase weekday visits','draft','manual',
  '2026-08-20T15:00:00','Asia/Kolkata',
  '2026-08-17T13:00:00+05:30','2026-08-17T19:35:00+05:30'
);
INSERT INTO post_versions (
  id,post_id,platform_id,social_account_id,hook,caption,cta,hashtags,title,
  description,keywords,creative_idea,image_prompt,platform_metadata,created_at,updated_at
) VALUES (
  'demo-version-draft-li','demo-post-draft','twitter','demo-account-twitter',
  'The right meeting space can change the conversation.',
  'For founders, freelancers and small teams in Surat, a relaxed coffee meeting can make collaboration feel more natural. ABC Cafe offers a comfortable local setting for the next idea session.',
  'Plan your next coffee meeting','["#SuratBusiness","#CoffeeMeeting","#LocalBusiness"]',
  'A Better Coffee Meeting','Concise Twitter version','["coffee meeting","Surat business"]',
  'Laptop, notebook and coffee arranged in a quiet cafe corner',
  'Professional editorial photograph of a laptop, notebook and coffee in a bright cafe meeting corner, no logos, no text','{"demo":true}',
  '2026-08-17T13:00:00+05:30','2026-08-17T19:35:00+05:30'
);

INSERT INTO analytics (
  id,client_id,social_account_id,post_version_id,external_post_id,
  period_start,period_end,collected_at,reach,impressions,views,likes,
  comments,shares,saves,clicks,followers_gained,engagement_rate,
  raw_metrics,followers,campaign_id,content_type
) VALUES
  ('demo-analytics-ig','demo-client-abc-cafe','demo-account-instagram','demo-version-published-ig','mock-instagram-demo-001',
   '2026-08-15','2026-08-15','2026-08-17T18:30:00+05:30',8420,10950,9100,688,41,96,174,122,38,11.86,
   '{"source":"mock_demo"}',3210,'demo-campaign-weekend','image_post'),
  ('demo-analytics-fb','demo-client-abc-cafe','demo-account-facebook',NULL,'mock-facebook-demo-history',
   '2026-08-14','2026-08-16','2026-08-17T18:30:00+05:30',3950,5170,4020,188,27,45,31,74,16,7.37,
   '{"source":"mock_demo"}',1840,'demo-campaign-weekend','carousel');

INSERT INTO ai_recommendations (
  id,client_id,period_start,period_end,findings,successful_topics,weak_topics,
  successful_formats,weak_formats,posting_recommendations,
  strategy_recommendations,future_ideas,raw_content,created_at
) VALUES (
  'demo-ai-recommendation','demo-client-abc-cafe','2026-08-14','2026-08-17',
  '["Cold brew content generated strong saves","Local weekend hooks improved engagement"]',
  '["Cold brew","Weekend plans","Behind the scenes"]','["Generic promotions"]',
  '["Image posts","Short-form process videos"]','["Long text-only promotions"]',
  '["Post visual content Friday evening","Use a local Surat reference in opening hooks"]',
  '["Increase educational coffee content","Keep direct promotion below one third of the plan"]',
  '["How beans change flavour","Cafe work-session tips","Customer favourite poll"]',
  'DEMO AI recommendation imported manually; no AI API was used.',
  '2026-08-17T18:45:00+05:30'
);

INSERT INTO reports (
  id,client_id,campaign_id,report_type,period_start,period_end,
  metrics_snapshot,analysis_prompt,imported_analysis,recommendations,
  status,created_at,updated_at
) VALUES (
  'demo-report-weekly','demo-client-abc-cafe','demo-campaign-weekend','weekly',
  '2026-08-11','2026-08-17',
  '{"totalReach":12370,"totalEngagement":1290,"followersGained":54,"bestPlatform":"Instagram","platformComparison":[{"platform":"instagram","reach":8420,"engagementRate":11.86},{"platform":"facebook","reach":3950,"engagementRate":7.37}]}',
  'Analyse this fictional ABC Cafe demo performance and recommend next-week content.',
  'Instagram cold brew content led the week. Continue visual education and local weekend hooks.',
  '["Increase short process videos","Reuse the high-performing weekend theme"]',
  'ready','2026-08-17T19:00:00+05:30','2026-08-17T19:00:00+05:30'
);

INSERT INTO activity_logs (id,client_id,entity_type,entity_id,action,summary,metadata,created_at) VALUES
  ('demo-activity-client','demo-client-abc-cafe','client','demo-client-abc-cafe','created','ABC Cafe — DEMO client created','{"demo":true}','2026-08-17T10:00:00+05:30'),
  ('demo-activity-prompt','demo-client-abc-cafe','ai_prompt','demo-ai-prompt','prompt_created','7-day ChatGPT prompt prepared','{"demo":true}','2026-08-17T10:30:00+05:30'),
  ('demo-activity-review','demo-client-abc-cafe','post','demo-post-review','submitted','Weekend Brunch post sent for human review','{"demo":true}','2026-08-17T17:00:00+05:30'),
  ('demo-activity-scheduled','demo-client-abc-cafe','schedule','demo-schedule-upcoming','scheduled','YouTube demo scheduled for 18 August at 11:00 AM','{"demo":true}','2026-08-17T18:05:00+05:30'),
  ('demo-activity-published','demo-client-abc-cafe','post','demo-post-published','published','Cold Brew Friday published successfully in Mock Mode','{"demo":true}','2026-08-17T18:10:00+05:30'),
  ('demo-activity-analytics','demo-client-abc-cafe','analytics','demo-analytics-ig','analytics_updated','Mock analytics collected and learning loop updated','{"demo":true}','2026-08-17T18:45:00+05:30');

INSERT INTO notifications (
  id,kind,title,body,entity_type,entity_id,is_read,created_at
) VALUES
  ('demo-notification-review','approval_required','Demo post needs approval','Weekend Brunch Invitation is ready for your review.','post','demo-post-review',0,'2026-08-17T19:35:00+05:30'),
  ('demo-notification-scheduled','post_scheduled','Demo post scheduled','YouTube Mock post is scheduled for 18 August at 11:00 AM.','post','demo-post-scheduled',0,'2026-08-17T19:35:00+05:30');

COMMIT;
