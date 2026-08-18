import type { PlatformKey } from "../types/client";
import type { PromptBuildContext } from "../types/aiWorkspace";

const platformLabels: Record<PlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

const platformRequirements: Record<PlatformKey, string[]> = {
  instagram: ["A scroll-stopping hook", "An engaging caption", "Relevant hashtags", "A clear CTA", "Creative idea", "Detailed image prompt"],
  facebook: ["A conversational opening", "A community-friendly caption", "A natural CTA", "Recommended post format", "Creative idea"],
  linkedin: ["A professional opening", "Business-focused value", "A credible professional CTA", "Relevant professional hashtags", "Visual concept"],
  youtube: ["Video title", "Description", "Keywords/tags", "Opening hook", "Thumbnail concept", "Recommended video format"],
};

function list(values: string[], fallback = "Not provided"): string {
  return values.length ? values.join(", ") : fallback;
}

function field(value: string, fallback = "Not provided"): string {
  return value.trim() || fallback;
}

function platformOutput(platform: PlatformKey): Record<string, unknown> {
  const common = { hook: "", caption: "", cta: "", creative_idea: "" };
  if (platform === "instagram") return { ...common, hashtags: [""], image_prompt: "" };
  if (platform === "facebook") return { ...common, post_format: "" };
  if (platform === "linkedin") return { ...common, hashtags: [""] };
  return { title: "", description: "", hook: "", keywords: [""], thumbnail_concept: "", video_format: "" };
}

export function buildChatGptPrompt({ client, campaign, input, recommendations = [] }: PromptBuildContext): string {
  const brand = client.brandProfile;
  const platformNames = input.platforms.map((platform) => platformLabels[platform]);
  const platformSchema = Object.fromEntries(input.platforms.map((platform) => [platform, platformOutput(platform)]));
  const outputSchema = {
    format_version: "social_content_v1",
    client_id: client.id,
    client_name: client.clientName,
    campaign: campaign?.name ?? null,
    posts: [{
      sequence: 1,
      title: "",
      topic: "",
      goal: input.goal,
      content_type: input.contentType,
      scheduled_date: "YYYY-MM-DD",
      recommended_time: "HH:MM",
      timezone: "Asia/Kolkata",
      platforms: platformSchema,
    }],
  };

  const platformSections = input.platforms.map((platform) => [
    `${platformLabels[platform]} requirements:`,
    ...platformRequirements[platform].map((requirement) => `- ${requirement}`),
  ].join("\n")).join("\n\n");

  return [
    "You are a senior social-media strategist and platform-native copywriter.",
    "Create original social-media content using the client context below. Do not call tools, browse, or invent business claims that are not present in this brief.",
    "",
    "CLIENT AND BRAND MEMORY",
    `Client: ${client.clientName}`,
    `Company: ${field(client.companyName)}`,
    `Brand: ${field(client.brandName, client.clientName)}`,
    `Industry: ${field(client.industry)}`,
    `Location: ${field(client.location)}`,
    `Business description: ${field(client.businessDescription)}`,
    `Products: ${list(client.products)}`,
    `Services: ${list(client.services)}`,
    `Target audience: ${field(client.targetAudience || brand.primaryAudience)}`,
    `Marketing goals: ${list(client.marketingGoals)}`,
    `Brand voice: ${field(brand.brandVoice)}`,
    `Brand personality: ${list(brand.brandPersonality)}`,
    `Brand colours: ${list(brand.brandColours)}`,
    `Fonts: ${list(brand.fonts)}`,
    `Preferred CTA: ${field(brand.preferredCta)}`,
    `Content style: ${field(brand.contentStyle)}`,
    `Brand keywords: ${list(brand.keywords)}`,
    `Topics and language to avoid: ${list(brand.topicsToAvoid, "None recorded")}`,
    `Competitors: ${list(client.competitors)}`,
    `Usual posting frequency: ${field(client.postingFrequency)}`,
    "",
    "PREVIOUS PERFORMANCE LEARNING",
    recommendations.length ? recommendations.slice(0, 3).map((recommendation, index) => [
      `Learning ${index + 1} (${recommendation.periodStart || "previous period"} to ${recommendation.periodEnd || "latest"}):`,
      `- Findings: ${list(recommendation.findings)}`,
      `- Successful topics: ${list(recommendation.successfulTopics)}`,
      `- Successful formats: ${list(recommendation.successfulFormats)}`,
      `- Weak formats: ${list(recommendation.weakFormats)}`,
      `- Strategy recommendations: ${list(recommendation.strategyRecommendations)}`,
      `- Future ideas: ${list(recommendation.futureIdeas)}`,
    ].join("\n")).join("\n") : "No imported performance recommendations are available yet. Do not invent previous results.",
    "",
    "CONTENT REQUEST",
    `Template: ${input.templateType}`,
    `Campaign: ${campaign ? `${campaign.name}${campaign.objective ? ` — ${campaign.objective}` : ""}` : "No campaign selected"}`,
    `Goal: ${input.goal.trim()}`,
    `Topic: ${input.topic.trim()}`,
    `Content type: ${input.contentType}`,
    `Requested tone: ${input.tone.trim()}`,
    `Platforms: ${platformNames.join(", ")}`,
    `Number of posts: ${input.postCount}`,
    `Date range: ${input.startDate || "Flexible"} to ${input.endDate || "Flexible"}`,
    "Timezone: Asia/Kolkata",
    "",
    "CREATE ONCE, ADAPT EVERYWHERE",
    "Use the same strategic idea where appropriate, but write every platform version independently. Never duplicate the exact caption across platforms. Respect each platform's audience, tone, format, length, CTA style and discovery conventions.",
    "",
    platformSections,
    "",
    "QUALITY RULES",
    "- Keep every claim accurate to the supplied brand information.",
    "- Avoid generic filler, repeated hooks and repeated CTAs.",
    "- Vary content angles across educational, promotional, engagement and trust-building posts where appropriate.",
    "- Use the preferred CTA naturally; adapt it when a platform needs a different professional tone.",
    "- Recommend realistic publishing dates and times inside the requested range.",
    "- When previous performance learning is present, apply it explicitly to improve this plan.",
    "- Do not include a platform key that was not requested.",
    "",
    "REQUIRED RESPONSE FORMAT",
    "Return exactly one valid JSON object. Do not use Markdown fences, commentary, headings before the JSON, or trailing text. Use valid JSON double quotes and no comments. The user should be able to paste the result into a local importer without editing JSON.",
    "Use this exact structure and repeat the post object until the requested post count is reached:",
    JSON.stringify(outputSchema, null, 2),
  ].join("\n");
}
