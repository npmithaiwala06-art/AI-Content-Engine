import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";
import { listPublishingQueue } from "./automation";
import type {
  AnalyticsDashboard,
  OfficialAnalyticsCollection,
  RecommendationInput,
  RecommendationRecord,
} from "../types/analytics";

const dataKey = "socialflow.preview.analytics.v1";
const recKey = "socialflow.preview.recommendations.v1";

type Row = {
  id: string;
  clientId: string;
  platform: string;
  postId: string;
  title: string;
  date: string;
  contentType: string;
  reach: number;
  engagement: number;
  followersGained: number;
};

const read = <T>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
};

export async function collectMockAnalytics(): Promise<number> {
  if (isDesktopRuntime()) return invoke("collect_mock_analytics");
  const rows = read<Row>(dataKey);
  const seen = new Set(rows.map((row) => row.id));
  const queue = await listPublishingQueue("published");
  for (const item of queue) {
    if (seen.has(item.id)) continue;
    const seed = [...item.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const reach = 500 + (seed % 9500);
    const engagement = Math.round(reach * (0.04 + (seed % 70) / 1000));
    rows.push({
      id: item.id,
      clientId: item.clientId,
      platform: item.platform,
      postId: item.postId,
      title: item.title,
      date: item.updatedAt.slice(0, 10),
      contentType: "social_post",
      reach,
      engagement,
      followersGained: seed % 35,
    });
  }
  localStorage.setItem(dataKey, JSON.stringify(rows));
  return rows.length - seen.size;
}

export async function collectOfficialAnalytics(): Promise<OfficialAnalyticsCollection> {
  if (!isDesktopRuntime()) {
    throw new Error("Connected-platform analytics are available only in the macOS desktop app.");
  }
  return invoke("collect_official_analytics");
}

export async function getAnalyticsDashboard(filters: {
  clientId?: string;
  platform?: string;
  campaignId?: string;
  start: string;
  end: string;
}): Promise<AnalyticsDashboard> {
  if (isDesktopRuntime()) return invoke("get_analytics_dashboard", filters);
  const rows = read<Row>(dataKey).filter(
    (row) =>
      row.date >= filters.start &&
      row.date <= filters.end &&
      (!filters.clientId || row.clientId === filters.clientId) &&
      (!filters.platform || filters.platform === "all" || row.platform === filters.platform),
  );
  const group = (field: "date" | "platform" | "contentType") => {
    const grouped = new Map<string, Row[]>();
    rows.forEach((row) => grouped.set(row[field], [...(grouped.get(row[field]) ?? []), row]));
    return grouped;
  };
  const platforms = [...group("platform")]
    .map(([platform, values]) => {
      const reach = values.reduce((sum, row) => sum + row.reach, 0);
      const engagement = values.reduce((sum, row) => sum + row.engagement, 0);
      return {
        platform,
        posts: values.length,
        reach,
        engagement,
        engagementRate: reach ? (engagement / reach) * 100 : 0,
      };
    })
    .sort((a, b) => b.engagementRate - a.engagementRate);
  const top = rows
    .map((row) => ({
      postId: row.postId,
      title: row.title,
      platform: row.platform,
      reach: row.reach,
      engagement: row.engagement,
      engagementRate: row.reach ? (row.engagement / row.reach) * 100 : 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate);
  const types = [...group("contentType")].map(([platform, values]) => {
    const reach = values.reduce((sum, row) => sum + row.reach, 0);
    const engagement = values.reduce((sum, row) => sum + row.engagement, 0);
    return {
      platform,
      posts: values.length,
      reach,
      engagement,
      engagementRate: reach ? (engagement / reach) * 100 : 0,
    };
  });
  return {
    totalReach: rows.reduce((sum, row) => sum + row.reach, 0),
    totalEngagement: rows.reduce((sum, row) => sum + row.engagement, 0),
    followersGained: rows.reduce((sum, row) => sum + row.followersGained, 0),
    bestPlatform: platforms[0]?.platform ?? "—",
    bestPost: top[0]?.title ?? "—",
    timeSeries: [...group("date")].map(([label, values]) => ({
      label,
      reach: values.reduce((sum, row) => sum + row.reach, 0),
      engagement: values.reduce((sum, row) => sum + row.engagement, 0),
      followersGained: values.reduce((sum, row) => sum + row.followersGained, 0),
    })),
    platformComparison: platforms,
    topPosts: top.slice(0, 10),
    contentTypePerformance: types,
  };
}

export async function buildAnalyticsPrompt(
  clientId: string,
  start: string,
  end: string,
  clientName = "Client",
  dashboard?: AnalyticsDashboard,
): Promise<string> {
  if (isDesktopRuntime()) return invoke("build_analytics_prompt", { clientId, start, end });
  return `You are a senior social-media strategist.\n\nCLIENT: ${clientName}\nPERIOD: ${start} to ${end}\nMETRICS JSON:\n${JSON.stringify(dashboard, null, 2)}\n\nGive overall performance, what worked, what failed, best platforms, formats, topics, posting patterns, recommendations, next strategy and future ideas. End with valid JSON keys: findings, successful_topics, weak_topics, successful_formats, weak_formats, posting_recommendations, strategy_recommendations, future_ideas.`;
}

const recommendationKeys = [
  "findings",
  "successful_topics",
  "weak_topics",
  "successful_formats",
  "weak_formats",
  "posting_recommendations",
  "strategy_recommendations",
  "future_ideas",
] as const;

export const recommendationExample = JSON.stringify(
  {
    findings: ["Educational posts generated the strongest engagement."],
    successful_topics: ["How-to tips", "Customer stories"],
    weak_topics: ["Generic promotions"],
    successful_formats: ["Reels", "Carousels"],
    weak_formats: ["Text-only promotions"],
    posting_recommendations: ["Publish four times per week and test evening slots."],
    strategy_recommendations: ["Increase educational Reels and reduce direct promotions."],
    future_ideas: ["A three-part how-to Reel series", "Customer transformation carousel"],
  },
  null,
  2,
);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractBalancedObjects(text: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function collectObjects(value: unknown, objects: JsonObject[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectObjects(entry, objects));
    return;
  }
  if (!isObject(value)) return;
  objects.push(value);
  Object.values(value).forEach((entry) => collectObjects(entry, objects));
}

function keyScore(value: JsonObject): number {
  return recommendationKeys.reduce((score, key) => {
    const camel = key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
    return score + (key in value || camel in value ? 1 : 0);
  }, 0);
}

function findRecommendationObject(raw: string): JsonObject | undefined {
  const sources = [
    ...[...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]),
    raw,
  ];
  const objects: JsonObject[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const candidates = [source.trim(), ...extractBalancedObjects(source)];
    for (const candidate of candidates) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      try {
        collectObjects(JSON.parse(candidate), objects);
      } catch {
        // Prose around JSON is normal. Other balanced candidates are still checked.
      }
    }
  }
  return objects.sort((left, right) => keyScore(right) - keyScore(left))[0];
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return [];
}

export function parseRecommendations(
  raw: string,
  clientId: string,
  start: string,
  end: string,
): RecommendationInput {
  const input = raw.trim();
  if (!input) throw new Error("Paste ChatGPT's completed analysis before selecting Parse & Preview.");
  const value = findRecommendationObject(input);
  const score = value ? keyScore(value) : 0;
  if (!value || score < 2) {
    if (/METRICS JSON|PREVIOUS RECOMMENDATIONS JSON|Give:\s*1\)|You are a senior social-media strategist/i.test(input)) {
      throw new Error(
        "This is the analytics prompt, not ChatGPT's answer. Copy the prompt into ChatGPT, then paste ChatGPT's completed analysis here.",
      );
    }
    throw new Error(
      "No recommendation JSON was found. Paste ChatGPT's full answer, including the final JSON object, or use Show Example Format.",
    );
  }
  const output: Record<string, unknown> = {
    clientId,
    periodStart: start,
    periodEnd: end,
    rawContent: raw,
  };
  for (const key of recommendationKeys) {
    const camel = key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
    output[camel] = toStringList(value[key] ?? value[camel]);
  }
  if (!(output.strategyRecommendations as string[]).length) {
    throw new Error("The result needs at least one strategy recommendation before it can be saved.");
  }
  return output as unknown as RecommendationInput;
}

export async function importAiRecommendations(input: RecommendationInput): Promise<string> {
  if (isDesktopRuntime()) return invoke("import_ai_recommendations", { input });
  const id = crypto.randomUUID();
  localStorage.setItem(
    recKey,
    JSON.stringify([{ id, ...input, createdAt: new Date().toISOString() }, ...read<RecommendationRecord>(recKey)]),
  );
  return id;
}

export async function listAiRecommendations(clientId?: string): Promise<RecommendationRecord[]> {
  if (isDesktopRuntime()) return invoke("list_ai_recommendations", { clientId });
  return read<RecommendationRecord>(recKey).filter((record) => !clientId || record.clientId === clientId);
}
