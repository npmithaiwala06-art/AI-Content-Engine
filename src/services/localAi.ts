import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";

export interface LocalAiStatus {
  installed: boolean;
  running: boolean;
  provider: string;
  models: string[];
  detail: string;
}

export interface LocalAiResult {
  provider: string;
  model: string;
  content: string;
}

export async function getLocalAiStatus(): Promise<LocalAiStatus> {
  if (isDesktopRuntime()) return invoke("get_local_ai_status");
  return {
    installed: false,
    running: false,
    provider: "Desktop-only local LLM",
    models: [],
    detail: "Open the desktop app to detect a local Ollama installation.",
  };
}

export async function generateWithLocalAi(
  model: string,
  prompt: string,
): Promise<LocalAiResult> {
  if (!isDesktopRuntime()) {
    throw new Error("Local LLM generation is available only in the desktop app.");
  }
  return invoke("generate_with_local_ai", { model, prompt });
}
