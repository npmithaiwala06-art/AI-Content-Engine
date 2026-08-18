import type { ClientDetail, PlatformKey } from "./client";
import type { RecommendationRecord } from "./analytics";

export type PromptTemplateType = "single_post" | "7_day" | "15_day" | "30_day" | "campaign";

export interface CampaignOption {
  id: string;
  name: string;
  objective: string;
  status: string;
}

export interface AiWorkspaceInput {
  clientId: string;
  campaignId: string;
  templateType: PromptTemplateType;
  goal: string;
  topic: string;
  contentType: string;
  tone: string;
  platforms: PlatformKey[];
  postCount: number;
  startDate: string;
  endDate: string;
}

export interface PromptBuildContext {
  client: ClientDetail;
  campaign?: CampaignOption;
  input: AiWorkspaceInput;
  recommendations?: RecommendationRecord[];
}

export interface SaveAiPromptInput {
  clientId: string;
  campaignId?: string;
  templateType: PromptTemplateType;
  goal: string;
  topic: string;
  contentType: string;
  tone: string;
  platforms: PlatformKey[];
  postCount: number;
  startDate?: string;
  endDate?: string;
  promptText: string;
}

export interface AiPromptHistoryItem {
  id: string;
  clientId: string;
  clientName: string;
  brandName: string;
  campaignName?: string;
  templateType: PromptTemplateType;
  goal: string;
  topic: string;
  platforms: PlatformKey[];
  postCount: number;
  promptText: string;
  copyCount: number;
  lastCopiedAt?: string;
  createdAt: string;
}

export interface ManualAiWorkflow {
  provider: "manual_chatgpt";
  usesApi: false;
  prompt: string;
  outputFormat: "social_content_v1";
  steps: string[];
}

export const promptTemplates: Array<{ type: PromptTemplateType; label: string; description: string; posts: number; days: number }> = [
  { type: "single_post", label: "Single post", description: "One idea adapted per platform", posts: 1, days: 1 },
  { type: "7_day", label: "7-day plan", description: "A focused week of content", posts: 7, days: 7 },
  { type: "15_day", label: "15-day plan", description: "A balanced half-month plan", posts: 15, days: 15 },
  { type: "30_day", label: "30-day plan", description: "A complete monthly calendar", posts: 30, days: 30 },
  { type: "campaign", label: "Campaign", description: "Goal-led campaign content", posts: 10, days: 14 },
];
