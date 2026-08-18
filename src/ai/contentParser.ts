import type { PlatformKey } from "../types/client";
import type { ImportedPlatformDraft, ImportedPostDraft, ParsedContentImport } from "../types/contentImport";

const platforms: PlatformKey[] = ["instagram", "facebook", "linkedin", "youtube"];

export class ContentParseError extends Error {
  constructor(message: string, readonly issues: string[] = []) {
    super(message);
    this.name = "ContentParseError";
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  return raw.split(/[,\n]+|\s+(?=#)/).map((item) => item.trim()).filter(Boolean);
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ContentParseError("Paste the ChatGPT result before parsing.");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  throw new ContentParseError("No JSON object was found.", ["Use the Phase 3 prompt and ask ChatGPT to return only one JSON object."]);
}

function platformDraft(platform: PlatformKey, value: Record<string, unknown>, post: Record<string, unknown>): ImportedPlatformDraft {
  return {
    platform,
    hook: text(value.hook ?? post.hook),
    caption: text(value.caption ?? value.content),
    cta: text(value.cta ?? post.cta),
    hashtags: list(value.hashtags ?? post.hashtags),
    title: text(value.title),
    description: text(value.description),
    keywords: list(value.keywords ?? value.tags),
    creativeIdea: text(value.creative_idea ?? value.creativeIdea ?? post.creative_idea ?? post.creative),
    imagePrompt: text(value.image_prompt ?? value.imagePrompt ?? post.image_prompt),
    thumbnailConcept: text(value.thumbnail_concept ?? value.thumbnailConcept),
    postFormat: text(value.post_format ?? value.postFormat),
    videoFormat: text(value.video_format ?? value.videoFormat),
    officialMediaUrl: text(value.official_media_url ?? value.officialMediaUrl),
    privacyStatus: text(value.privacy_status ?? value.privacyStatus) || "private",
    categoryId: text(value.category_id ?? value.categoryId) || "22",
  };
}

export function parseChatGptContent(raw: string): ParsedContentImport {
  let root: Record<string, unknown>;
  try {
    root = object(JSON.parse(extractJson(raw))) ?? {};
  } catch (error) {
    if (error instanceof ContentParseError) throw error;
    throw new ContentParseError("The ChatGPT result is not valid JSON.", [error instanceof Error ? error.message : String(error), "Do not manually repair JSON. Ask ChatGPT to return the exact social_content_v1 structure again."]);
  }

  const rawPosts = root.posts;
  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    throw new ContentParseError("No posts were found in the result.", ["The top-level JSON object must contain a non-empty posts array."]);
  }
  if (rawPosts.length > 100) throw new ContentParseError("A single import can contain at most 100 posts.");

  const issues: string[] = [];
  const parsedPosts: ImportedPostDraft[] = [];
  rawPosts.forEach((rawPost, index) => {
    const post = object(rawPost);
    if (!post) { issues.push(`Post ${index + 1} must be an object.`); return; }
    const versions = object(post.platforms) ?? {};
    const parsedPlatforms = platforms.flatMap((platform) => {
      const version = object(versions[platform]);
      return version ? [platformDraft(platform, version, post)] : [];
    });
    const title = text(post.title) || `Imported post ${index + 1}`;
    const topic = text(post.topic ?? post.core_idea);
    const contentType = text(post.content_type ?? post.contentType) || "image_post";
    if (!topic) issues.push(`Post ${index + 1} is missing topic.`);
    if (!parsedPlatforms.length) issues.push(`Post ${index + 1} has no supported platform versions.`);
    parsedPlatforms.forEach((version) => {
      if (!version.caption && !version.description && !version.title) issues.push(`Post ${index + 1} has no usable ${version.platform} content.`);
    });
    parsedPosts.push({
      tempId: `import-${index + 1}`,
      title,
      topic,
      goal: text(post.goal),
      contentType,
      scheduledDate: text(post.scheduled_date ?? post.publish_date) || undefined,
      recommendedTime: text(post.recommended_time ?? post.publish_time) || undefined,
      timezone: text(post.timezone) || "Asia/Kolkata",
      platforms: parsedPlatforms,
    });
  });
  if (issues.length) throw new ContentParseError("Some posts need correction before they can be reviewed.", issues);

  const formatVersion = text(root.format_version) || "unversioned";
  const warnings: string[] = [];
  if (formatVersion !== "social_content_v1") warnings.push(`Expected social_content_v1 but received ${formatVersion}. The compatible fields were still parsed.`);
  return {
    formatVersion,
    clientIdHint: text(root.client_id) || undefined,
    clientNameHint: text(root.client_name ?? root.client) || undefined,
    campaignName: text(root.campaign) || undefined,
    posts: parsedPosts,
    warnings,
  };
}
