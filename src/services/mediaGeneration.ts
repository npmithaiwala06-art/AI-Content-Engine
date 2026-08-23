import type { GeneratedCreativeMedia } from "./localCreativeRenderer";

export type GeneratedMediaKind = "image" | "video";

export interface MediaGenerationRequest {
  kind: GeneratedMediaKind;
  sourceContent: string;
  sourcePrompt: string;
}

export interface MediaGenerationProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: GeneratedMediaKind[];
  generate(request: MediaGenerationRequest): Promise<GeneratedCreativeMedia[]>;
}

export interface MediaProviderSelection {
  image: string;
  video: string;
}

export class MediaProviderRegistry {
  private readonly providers: Map<string, MediaGenerationProvider>;

  constructor(providers: MediaGenerationProvider[], private readonly selection: MediaProviderSelection) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
    if (this.providers.size !== providers.length) throw new Error("Media provider IDs must be unique.");
  }

  async generate(request: MediaGenerationRequest): Promise<GeneratedCreativeMedia[]> {
    const providerId = this.selection[request.kind];
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Configured ${request.kind} provider '${providerId}' is not available.`);
    if (!provider.capabilities.includes(request.kind)) {
      throw new Error(`Configured provider '${provider.label}' does not support ${request.kind} generation.`);
    }
    return provider.generate(request);
  }

  list(): MediaGenerationProvider[] {
    return [...this.providers.values()];
  }
}
