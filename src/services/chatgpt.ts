import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";

export interface CodexStatus {
  installed: boolean;
  authenticated: boolean;
  loginInProgress: boolean;
  provider: string;
  detail: string;
}

export interface CodexGenerationResult {
  provider: "codex_chatgpt_subscription";
  model: string;
  content: string;
  elapsedMs: number;
}

export type CodexCreativeMode = "image" | "video" | "both";

export interface PendingCodexCreativeRequest {
  prompt: string;
  clientName: string;
  goal: string;
  topic: string;
  suggestedMode: CodexCreativeMode;
}

const pendingCreativeRequestKey = "socialflow.pendingCodexCreativeRequest.v1";

export function stageCodexCreativeRequest(input: PendingCodexCreativeRequest): void {
  sessionStorage.setItem(pendingCreativeRequestKey, JSON.stringify(input));
}

export function takeStagedCodexCreativeRequest(): PendingCodexCreativeRequest | undefined {
  const value = sessionStorage.getItem(pendingCreativeRequestKey);
  if (!value) return undefined;
  sessionStorage.removeItem(pendingCreativeRequestKey);
  try {
    return JSON.parse(value) as PendingCodexCreativeRequest;
  } catch {
    return undefined;
  }
}

const browserStatus: CodexStatus = {
  installed: false,
  authenticated: false,
  loginInProgress: false,
  provider: "Official Codex client",
  detail: "Connect ChatGPT subscription access from the SocialFlow OS desktop app.",
};

export async function getCodexStatus(): Promise<CodexStatus> {
  if (!isDesktopRuntime()) return browserStatus;
  return invoke<CodexStatus>("get_codex_status");
}

export async function connectCodex(): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("ChatGPT subscription connection is available in the SocialFlow OS desktop app.");
  }
  await invoke("start_codex_login");
}

export async function disconnectCodex(): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("ChatGPT subscription connection is available in the SocialFlow OS desktop app.");
  }
  await invoke("logout_codex");
}

export async function generateWithCodex(prompt: string): Promise<CodexGenerationResult> {
  if (!isDesktopRuntime()) {
    throw new Error("Codex generation is available in the SocialFlow OS desktop app.");
  }
  return invoke<CodexGenerationResult>("generate_with_codex", { prompt });
}
