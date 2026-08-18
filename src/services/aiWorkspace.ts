import { invoke } from "@tauri-apps/api/core";
import { getClient } from "./clients";
import type { AiPromptHistoryItem, CampaignOption, SaveAiPromptInput } from "../types/aiWorkspace";

const previewHistoryKey = "socialflow.preview.aiPromptHistory.v1";

function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function loadPreviewHistory(): AiPromptHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(previewHistoryKey) ?? "[]") as AiPromptHistoryItem[];
  } catch {
    return [];
  }
}

function savePreviewHistory(history: AiPromptHistoryItem[]) {
  localStorage.setItem(previewHistoryKey, JSON.stringify(history.slice(0, 30)));
}

export async function listAiCampaignOptions(clientId: string): Promise<CampaignOption[]> {
  if (!clientId) return [];
  if (isDesktopRuntime()) return invoke<CampaignOption[]>("list_ai_campaign_options", { clientId });
  return [];
}

export async function saveAiPrompt(input: SaveAiPromptInput): Promise<string> {
  if (isDesktopRuntime()) return invoke<string>("save_ai_prompt", { input });
  const client = await getClient(input.clientId);
  const id = globalThis.crypto?.randomUUID?.() ?? `prompt-${Date.now()}`;
  const history = loadPreviewHistory();
  history.unshift({
    id,
    clientId: input.clientId,
    clientName: client.clientName,
    brandName: client.brandName || client.clientName,
    templateType: input.templateType,
    goal: input.goal,
    topic: input.topic,
    platforms: input.platforms,
    postCount: input.postCount,
    promptText: input.promptText,
    copyCount: 0,
    createdAt: new Date().toISOString(),
  });
  savePreviewHistory(history);
  return id;
}

export async function listAiPromptHistory(clientId?: string): Promise<AiPromptHistoryItem[]> {
  if (isDesktopRuntime()) return invoke<AiPromptHistoryItem[]>("list_ai_prompt_history", { clientId });
  const history = loadPreviewHistory();
  return clientId ? history.filter((item) => item.clientId === clientId) : history;
}

export async function markAiPromptCopied(promptId: string): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("mark_ai_prompt_copied", { promptId });
  const history = loadPreviewHistory();
  const prompt = history.find((item) => item.id === promptId);
  if (!prompt) throw new Error("Prompt not found");
  prompt.copyCount += 1;
  prompt.lastCopiedAt = new Date().toISOString();
  savePreviewHistory(history);
}
