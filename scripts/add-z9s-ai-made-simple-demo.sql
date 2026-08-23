PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

INSERT INTO campaigns (
  id, client_id, name, description, objective, start_date, end_date,
  status, audience, platforms, budget, created_at, updated_at
) VALUES (
  'z9s-ai-made-simple-demo-20260822',
  '69a1f116-4180-4eda-a19e-d361bf7f2593',
  'Z9S.AI — Latest AI Made Simple (30-Day Demo)',
  'A daily awareness series that turns fast-moving AI news, features and workflows into short, understandable and useful content. This draft includes a complete Day 1 reel demo for review before expanding the remaining 29 days.',
  'Build awareness by posting useful and current AI content every day for 30 days',
  '2026-08-23',
  '2026-09-21',
  'draft',
  'Students, professionals, creators and curious beginners who want practical ways to use AI in real life.',
  '["instagram","youtube","twitter"]',
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  description=excluded.description,
  objective=excluded.objective,
  start_date=excluded.start_date,
  end_date=excluded.end_date,
  status=excluded.status,
  audience=excluded.audience,
  platforms=excluded.platforms,
  updated_at=excluded.updated_at;

INSERT INTO content_plans (
  id, client_id, campaign_id, name, plan_type, start_date, end_date,
  goal, status, created_at, updated_at
) VALUES (
  'z9s-ai-made-simple-plan-20260822',
  '69a1f116-4180-4eda-a19e-d361bf7f2593',
  'z9s-ai-made-simple-demo-20260822',
  'Z9S.AI — 30 Days of Useful AI',
  '30_day',
  '2026-08-23',
  '2026-09-21',
  'Build awareness by posting useful and current AI content every day for 30 days. Core idea: Make the latest AI easy to understand, interesting to watch, and useful in real life.',
  'draft',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  goal=excluded.goal,
  status=excluded.status,
  updated_at=excluded.updated_at;

INSERT INTO posts (
  id, client_id, campaign_id, content_plan_id, title, core_idea,
  content_type, goal, status, source, proposed_publish_at, timezone,
  created_at, updated_at
) VALUES (
  'z9s-ai-made-simple-day-01',
  '69a1f116-4180-4eda-a19e-d361bf7f2593',
  'z9s-ai-made-simple-demo-20260822',
  'z9s-ai-made-simple-plan-20260822',
  'DEMO — Day 01: Is This New AI Tool Actually Useful?',
  'Make the latest AI easy to understand, interesting to watch, and useful in real life.',
  'reel',
  'Build awareness by posting useful and current AI content every day for 30 days',
  'draft',
  'template',
  '2026-08-23T11:00:00',
  'Asia/Kolkata',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title,
  core_idea=excluded.core_idea,
  content_type=excluded.content_type,
  goal=excluded.goal,
  proposed_publish_at=excluded.proposed_publish_at,
  updated_at=excluded.updated_at;

INSERT INTO post_versions (
  id, post_id, platform_id, hook, caption, cta, hashtags,
  creative_idea, image_prompt, platform_metadata, version_number,
  created_at, updated_at
) VALUES (
  'z9s-ai-made-simple-day-01-instagram',
  'z9s-ai-made-simple-day-01',
  'instagram',
  'A new AI tool launches every day. But is it actually useful?',
  'Before you follow the hype, give every new AI tool this 3-part test:\n\n1. Use it on one real task—not a perfect demo.\n2. Check one important answer against a trusted source.\n3. Compare the time and effort with your normal method.\n\nIf it saves time, stays accurate and feels easier, keep it. If not, skip it. The goal is not to collect AI tools. The goal is to improve real life.\n\nZ9S.AI makes the latest AI simple, watchable and practical—every day for 30 days.',
  'Follow @z9s_ai for one useful AI idea every day.',
  '["Z9SAI","AIExplained","AITools","AIProductivity","ArtificialIntelligence"]',
  '20-second vertical reel. 0–2s: rapid AI-tool cards and bold hook “USEFUL OR JUST HYPE?”. 2–6s: Step 1, test one real task. 6–10s: Step 2, verify one important fact. 10–14s: Step 3, compare time saved. 14–18s: green KEEP IT / red SKIP IT decision. 18–20s: Z9S.AI logo and follow CTA. Use fast clean motion, large subtitles, dark background with electric teal and violet accents, and no third-party logos.',
  'Vertical 9:16 thumbnail for Z9S.AI. Bold headline “USEFUL OR JUST HYPE?” with a glowing AI interface card split into a green check and red cross. Premium dark technology background, electric teal and violet lighting, large mobile-readable typography, clean modern composition, no third-party logos.',
  '{"campaign_day":1,"demo":true,"duration_seconds":20,"style":"fast educational","format":"vertical 9:16","approval_required":true}',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  hook=excluded.hook,
  caption=excluded.caption,
  cta=excluded.cta,
  hashtags=excluded.hashtags,
  creative_idea=excluded.creative_idea,
  image_prompt=excluded.image_prompt,
  platform_metadata=excluded.platform_metadata,
  updated_at=excluded.updated_at;

INSERT INTO post_versions (
  id, post_id, platform_id, hook, caption, cta, hashtags,
  creative_idea, platform_metadata, version_number, created_at, updated_at
) VALUES (
  'z9s-ai-made-simple-day-01-twitter',
  'z9s-ai-made-simple-day-01',
  'twitter',
  'New AI tool? Test it before you trust the hype.',
  'Use one real task. Verify one important answer. Compare the time with your normal workflow. If it is accurate, faster and easier, keep it. Otherwise, skip it. Better AI use beats more AI tools.',
  'Follow @z9s_ai for practical AI made simple.',
  '["Z9SAI","AITools","AIProductivity"]',
  'Turn the reel into a concise three-step checklist graphic and short native video clip.',
  '{"campaign_day":1,"demo":true,"character_limit":280,"approval_required":true}',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  hook=excluded.hook,
  caption=excluded.caption,
  cta=excluded.cta,
  hashtags=excluded.hashtags,
  creative_idea=excluded.creative_idea,
  platform_metadata=excluded.platform_metadata,
  updated_at=excluded.updated_at;

INSERT INTO post_versions (
  id, post_id, platform_id, title, description, cta, keywords,
  creative_idea, thumbnail_concept, platform_metadata, version_number,
  created_at, updated_at
) VALUES (
  'z9s-ai-made-simple-day-01-youtube',
  'z9s-ai-made-simple-day-01',
  'youtube',
  'New AI Tool? Use This 3-Step Test Before You Trust It',
  'A new AI tool can look impressive in a polished demo but still be useless in real life. Test it on one real task, verify one important answer and compare the time with your normal workflow. Keep tools that are accurate, faster and easier. Skip the rest.\n\nThis is Day 1 of Z9S.AI’s 30 Days of Useful AI—making the latest AI easy to understand, interesting to watch and useful in real life.',
  'Subscribe to Z9S AI Automation for one useful AI idea every day.',
  '["AI tools","AI explained","AI productivity","artificial intelligence","Z9S AI"]',
  '20-second YouTube Short using the same three-step test, optimized for sound-off viewing with large animated subtitles.',
  'USEFUL OR JUST HYPE? Split-screen green check and red cross, glowing AI interface, bold high-contrast text, Z9S.AI colours.',
  '{"campaign_day":1,"demo":true,"duration_seconds":20,"privacy_status":"private","format":"YouTube Short","approval_required":true}',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title,
  description=excluded.description,
  cta=excluded.cta,
  keywords=excluded.keywords,
  creative_idea=excluded.creative_idea,
  thumbnail_concept=excluded.thumbnail_concept,
  platform_metadata=excluded.platform_metadata,
  updated_at=excluded.updated_at;

COMMIT;
