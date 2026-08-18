import type { ManualAiWorkflow } from "../types/aiWorkspace";

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly usesApi: boolean;
  prepare(prompt: string): ManualAiWorkflow;
}
