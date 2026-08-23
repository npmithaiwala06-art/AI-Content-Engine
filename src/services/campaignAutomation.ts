import { parseChatGptContent } from "../ai/contentParser";
import { buildChatGptPrompt } from "../ai/promptBuilder";
import type { RecommendationRecord } from "../types/analytics";
import type { AiWorkspaceInput, CampaignOption, SaveAiPromptInput } from "../types/aiWorkspace";
import type { ClientDetail } from "../types/client";
import type { ContentImportSaveResult, ImportedPostDraft, SaveContentImportInput } from "../types/contentImport";
import { saveAiPrompt } from "./aiWorkspace";
import { generateWithCodex, type CodexGenerationResult } from "./chatgpt";
import { checkContentImportDuplicates, saveContentImport } from "./contentImport";
import { getPost, submitPostForReview } from "./contentStudio";
import { approvePost } from "./approvals";
import { schedulePost } from "./calendar";

export type AutomationMode = "manual_approval" | "auto_schedule" | "full_autopilot";

export interface CampaignAutomationRequest {
  client: ClientDetail;
  campaign?: CampaignOption;
  input: AiWorkspaceInput;
  recommendations: RecommendationRecord[];
  mode: AutomationMode;
  accountIds?: Record<string, string>;
}

export interface CampaignAutomationResult extends ContentImportSaveResult {
  mode: AutomationMode;
  promptId: string;
  provider: string;
  generatedPostCount: number;
}

interface CampaignAutomationDependencies {
  generate(prompt: string): Promise<CodexGenerationResult>;
  savePrompt(input: SaveAiPromptInput): Promise<string>;
  checkDuplicates(clientId: string, posts: ImportedPostDraft[]): Promise<string[]>;
  saveImport(input: SaveContentImportInput): Promise<ContentImportSaveResult>;
  activatePost?(postId: string, mode: AutomationMode, accountIds: Record<string, string>): Promise<void>;
}

const productionDependencies: CampaignAutomationDependencies = {
  generate: generateWithCodex,
  savePrompt: saveAiPrompt,
  checkDuplicates: checkContentImportDuplicates,
  saveImport: saveContentImport,
  activatePost: async (postId, mode, accountIds) => {
    const post = await getPost(postId);
    await submitPostForReview(postId);
    await approvePost(postId, `Approved by ${mode.replaceAll("_", " ")} automation`);
    if (!post.proposedDate || !post.proposedTime) throw new Error(`Generated post '${post.title}' has no publishing date or time.`);
    await schedulePost(postId, `${post.proposedDate}T${post.proposedTime}:00`, post.timezone || "Asia/Kolkata", accountIds);
  },
};

export async function executeCampaignAutomation(
  request: CampaignAutomationRequest,
  dependencies: CampaignAutomationDependencies = productionDependencies,
): Promise<CampaignAutomationResult> {
  const { client, campaign, input, recommendations, mode } = request;
  const prompt = buildChatGptPrompt({ client, campaign, input, recommendations });
  const promptId = await dependencies.savePrompt({
    clientId: client.id,
    campaignId: campaign?.id,
    templateType: input.templateType,
    goal: input.goal,
    topic: input.topic,
    contentType: input.contentType,
    tone: input.tone,
    platforms: input.platforms,
    postCount: input.postCount,
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    promptText: prompt,
  });
  const generated = await dependencies.generate(prompt);
  const parsed = parseChatGptContent(generated.content);
  const duplicateTempIds = await dependencies.checkDuplicates(client.id, parsed.posts);
  const duplicates = new Set(duplicateTempIds);
  const newPosts = parsed.posts.filter((post) => !duplicates.has(post.tempId));
  const imported = newPosts.length
    ? await dependencies.saveImport({
      clientId: client.id,
      campaignId: campaign?.id,
      aiPromptId: promptId,
      rawContent: generated.content,
      parsedPostCount: parsed.posts.length,
      posts: newPosts,
    })
    : { batchId: "", savedPostIds: [], duplicateTempIds };

  if (mode !== "manual_approval" && imported.savedPostIds.length) {
    if (!dependencies.activatePost) throw new Error("Automated scheduling is unavailable.");
    const accountIds = request.accountIds ?? {};
    for (const postId of imported.savedPostIds) {
      await dependencies.activatePost(postId, mode, accountIds);
    }
  }

  return {
    ...imported,
    duplicateTempIds: [...new Set([...duplicateTempIds, ...imported.duplicateTempIds])],
    mode,
    promptId,
    provider: generated.provider,
    generatedPostCount: parsed.posts.length,
  };
}
