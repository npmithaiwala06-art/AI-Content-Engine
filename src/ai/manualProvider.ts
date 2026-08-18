import type { AiProvider } from "./base";
import type { ManualAiWorkflow } from "../types/aiWorkspace";

class ManualChatGptProvider implements AiProvider {
  readonly id = "manual_chatgpt";
  readonly name = "ChatGPT manual workspace";
  readonly usesApi = false;

  prepare(prompt: string): ManualAiWorkflow {
    return {
      provider: "manual_chatgpt",
      usesApi: false,
      prompt,
      outputFormat: "social_content_v1",
      steps: [
        "Copy this structured prompt.",
        "Paste it into your ChatGPT conversation.",
        "Ask ChatGPT to return only the requested JSON object.",
        "Bring the result back through the Phase 4 importer.",
      ],
    };
  }
}

export const manualChatGptProvider: AiProvider = new ManualChatGptProvider();
