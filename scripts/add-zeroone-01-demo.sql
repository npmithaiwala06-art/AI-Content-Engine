PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

INSERT INTO clients (
  id, name, company_name, brand_name, industry, location, website,
  business_description, products, services, target_audience, marketing_goals,
  competitors, preferred_content, posting_frequency, timezone, main_platforms,
  status, created_at, updated_at
) VALUES (
  'zeroone-01', 'zeroone', 'ZeroOne D.O.T.S AI', 'ZEROONE',
  'AI implementation and automation', '', '',
  'An AI implementation partner helping businesses own practical AI systems built around their workflows, knowledge and competitive advantage.',
  '["Custom AI systems","Business AI workflows"]',
  '["AI implementation","Workflow automation","AI strategy","Custom AI agents"]',
  'Founders, operations leaders and growth teams ready to implement practical, owned AI systems.',
  '["Build brand awareness","Generate qualified implementation enquiries"]',
  '[]', '["Brand-led educational creatives","Premium AI implementation content"]',
  '"3 posts per week"', 'Asia/Kolkata', '["instagram"]', 'active',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, company_name=excluded.company_name, brand_name=excluded.brand_name,
  industry=excluded.industry, business_description=excluded.business_description,
  products=excluded.products, services=excluded.services, target_audience=excluded.target_audience,
  marketing_goals=excluded.marketing_goals, preferred_content=excluded.preferred_content,
  posting_frequency=excluded.posting_frequency, main_platforms=excluded.main_platforms,
  status='active', archived_at=NULL, updated_at=excluded.updated_at;

INSERT INTO media (
  id, client_id, campaign_id, kind, file_name, relative_path, mime_type,
  file_size_bytes, width, height, checksum, tags, platform_ids, created_at, updated_at
) VALUES (
  'zeroone-01-logo-reference', 'zeroone-01', NULL, 'logo',
  'zeroone-brand-reference.png',
  'media/clients/zeroone-01/logos/zeroone-brand-reference.png',
  'image/png', 29873, 612, 792,
  '7e92cec2a9df6c03d2192093ca2e9bad02a2e2823242b91f5568e11abc815498',
  '["brand","logo","zeroone"]', '["instagram"]',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  file_name=excluded.file_name, relative_path=excluded.relative_path,
  checksum=excluded.checksum, deleted_at=NULL, updated_at=excluded.updated_at;

INSERT INTO brand_profiles (
  id, client_id, brand_voice, brand_personality, primary_audience,
  main_offering, preferred_cta, avoid_topics, preferred_phrases,
  brand_colours, typography, content_rules, content_style, keywords, fonts,
  logo_media_id, updated_at
) VALUES (
  'zeroone-01-brand', 'zeroone-01',
  'Confident, intelligent, clear, human and implementation-focused.',
  '["Premium","Strategic","Practical","Future-ready"]',
  'Founders and business leaders who want practical AI ownership without unnecessary complexity.',
  'Custom AI implementation, automation systems and AI agents designed around each business.',
  'Let’s build your AI.', '[]',
  '["Your AI Implementation Partner","Own Your AI — Don’t Rent It."]',
  '["#181923","#BCA5FF","#B9E6D9","#FFC7A9","#F8F7FB"]',
  '{"headline":"precise bold sans serif","editorial":"elegant italic serif","supporting":"clean modern sans serif"}',
  '{"use_brand_led_design":true,"avoid_unverified_claims":true,"keep_copy_concise":true}',
  'Premium dark editorial technology design with disciplined typography, generous spacing and lavender, mint and peach accents.',
  '["AI implementation","custom AI","workflow automation","AI agents","owned AI"]',
  '["Helvetica Neue","Georgia"]', 'zeroone-01-logo-reference',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(client_id) DO UPDATE SET
  brand_voice=excluded.brand_voice, brand_personality=excluded.brand_personality,
  primary_audience=excluded.primary_audience, main_offering=excluded.main_offering,
  preferred_cta=excluded.preferred_cta, preferred_phrases=excluded.preferred_phrases,
  brand_colours=excluded.brand_colours, typography=excluded.typography,
  content_rules=excluded.content_rules, content_style=excluded.content_style,
  keywords=excluded.keywords, fonts=excluded.fonts, logo_media_id=excluded.logo_media_id,
  updated_at=excluded.updated_at;

INSERT INTO campaigns (
  id, client_id, name, description, objective, start_date, end_date,
  status, audience, platforms, budget, created_at, updated_at
) VALUES (
  'zeroone-campaign-01', 'zeroone-01', '01',
  'A brand-awareness demonstration introducing ZeroOne as the AI implementation partner for businesses that want to own their AI capabilities.',
  'Build awareness and generate qualified AI implementation conversations.',
  '2026-08-24', '2026-09-23', 'draft',
  'Founders, operations leaders and growth teams.', '["instagram"]', NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, description=excluded.description, objective=excluded.objective,
  start_date=excluded.start_date, end_date=excluded.end_date, audience=excluded.audience,
  platforms=excluded.platforms, updated_at=excluded.updated_at;

INSERT INTO content_plans (
  id, client_id, campaign_id, name, plan_type, start_date, end_date,
  goal, status, created_at, updated_at
) VALUES (
  'zeroone-plan-01', 'zeroone-01', 'zeroone-campaign-01', '01 — Brand Awareness Demo',
  'single', '2026-08-24', '2026-09-23',
  'Introduce ZeroOne through the message: stop renting intelligence; build AI that belongs to your business.',
  'draft', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, goal=excluded.goal, status=excluded.status, updated_at=excluded.updated_at;

INSERT INTO posts (
  id, client_id, campaign_id, content_plan_id, title, core_idea,
  content_type, goal, status, source, proposed_publish_at, timezone,
  created_at, updated_at
) VALUES (
  'zeroone-post-01', 'zeroone-01', 'zeroone-campaign-01', 'zeroone-plan-01',
  'Demo 01 — Own Your AI',
  'Stop renting generic intelligence. Build AI around your own workflows, knowledge and competitive edge.',
  'image_post', 'Build awareness and generate qualified implementation conversations.',
  'draft', 'template', '2026-08-26T11:00:00', 'Asia/Kolkata',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title, core_idea=excluded.core_idea, content_type=excluded.content_type,
  goal=excluded.goal, proposed_publish_at=excluded.proposed_publish_at,
  deleted_at=NULL, updated_at=excluded.updated_at;

INSERT INTO post_versions (
  id, post_id, platform_id, hook, caption, cta, hashtags,
  creative_idea, image_prompt, platform_metadata, version_number,
  created_at, updated_at
) VALUES (
  'zeroone-post-01-instagram', 'zeroone-post-01', 'instagram',
  'Stop renting intelligence. Build AI that belongs to your business.',
  'Generic AI can answer questions. The right AI implementation can become part of how your business works.\n\nZeroOne designs custom AI systems around your workflows, your knowledge and your competitive edge—so capability stays with your business.\n\nOwn Your AI. Don’t Rent It.',
  'Let’s build your AI.',
  '["ZeroOneAI","AIImplementation","BusinessAutomation","AIAgents","OwnYourAI"]',
  'Premium 4:5 brand-awareness creative using the ZeroOne 3×3 dots mark, dark editorial composition, disciplined white typography, and lavender, mint and peach accents.',
  'A premium dark 4:5 social advertisement for ZeroOne D.O.T.S AI. Headline: Stop renting intelligence. Subhead: Build AI that belongs to your business. Show three ownership benefits: your workflows, your knowledge, your edge. Minimal editorial technology aesthetic using #181923, lavender, mint and peach accents.',
  '{"demo":true,"campaign":"01","format":"4:5","approval_required":true}', 1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  hook=excluded.hook, caption=excluded.caption, cta=excluded.cta,
  hashtags=excluded.hashtags, creative_idea=excluded.creative_idea,
  image_prompt=excluded.image_prompt, platform_metadata=excluded.platform_metadata,
  updated_at=excluded.updated_at;

INSERT INTO media (
  id, client_id, campaign_id, kind, file_name, relative_path, mime_type,
  file_size_bytes, width, height, checksum, tags, platform_ids, created_at, updated_at
) VALUES (
  'zeroone-media-01', 'zeroone-01', 'zeroone-campaign-01', 'creative',
  'zeroone-01-demo.png',
  'media/clients/zeroone-01/generated/zeroone-01-demo.png',
  'image/png', 914226, 1080, 1350,
  'b340c147641100a0afaaeec4c91fc2869c124ad9a807280b965abb9cf6c0dc9c',
  '["zeroone","demo","01","brand-awareness"]', '["instagram"]',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
  file_name=excluded.file_name, relative_path=excluded.relative_path,
  file_size_bytes=excluded.file_size_bytes, width=excluded.width, height=excluded.height,
  checksum=excluded.checksum, tags=excluded.tags, platform_ids=excluded.platform_ids,
  deleted_at=NULL, updated_at=excluded.updated_at;

INSERT OR REPLACE INTO post_media (post_version_id, media_id, sort_order, role)
VALUES ('zeroone-post-01-instagram', 'zeroone-media-01', 0, 'primary');

INSERT INTO activity_logs (id, client_id, entity_type, entity_id, action, summary, metadata)
VALUES (
  'zeroone-demo-01-created', 'zeroone-01', 'campaign', 'zeroone-campaign-01',
  'created', 'Created ZeroOne campaign 01 demo with one Instagram creative.',
  '{"demo":true,"campaign":"01","post_id":"zeroone-post-01"}'
)
ON CONFLICT(id) DO NOTHING;

COMMIT;
